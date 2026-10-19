// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrKey, Address, xdr, rpc, nativeToScVal } from "@stellar/stellar-sdk";
import {
  approveProposal,
  executeProposal,
  batchExecuteProposals,
  cancelProposal,
  getSigners,
  isSigner,
  pollTransactionStatus,
} from "../actions";
import { computeApprovalBindingHash } from "../binding";
import { parseMultisigError, MULTISIG_ERROR_MESSAGES } from "../types";

describe("Multisig Actions & Soroban Integration", () => {
  const contractRaw = Buffer.from("1122334455667788990011223344556677889900112233445566778899001122", "hex");
  const contractId = StrKey.encodeContract(contractRaw);

  const signerRaw = Buffer.from("aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899", "hex");
  const signerAddress = StrKey.encodeEd25519PublicKey(signerRaw);

  const nonSignerRaw = Buffer.from("1111111111111111111111111111111111111111111111111111111111111111", "hex");
  const nonSignerAddress = StrKey.encodeEd25519PublicKey(nonSignerRaw);

  const signerSetHash = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  const dummyTxHash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

  const createMockSimulation = (auth: any[] = [], retval = xdr.ScVal.scvVoid()) => {
    const data = new xdr.SorobanTransactionData({
      ext: xdr.ExtensionPoint.v0(),
      resources: new xdr.SorobanResources({
        footprint: new xdr.LedgerFootprint({ readOnly: [], readWrite: [] }),
        instructions: 100,
        diskReadBytes: 100,
        writeBytes: 100,
      }),
      resourceFee: BigInt(100),
    });

    return {
      _parsed: true,
      transactionData: {
        build: () => data,
      },
      minResourceFee: "100",
      result: {
        auth,
        retval,
      },
    };
  };

  const createMockAuthEntry = (bindingHash: Buffer, contract: string, caller: string) => {
    return new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: new Address(caller).toScAddress(),
          nonce: BigInt(0),
          signatureExpirationLedger: 100,
          signature: xdr.ScVal.scvVoid(),
        })
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
          new xdr.InvokeContractArgs({
            contractAddress: new Address(contract).toScAddress(),
            functionName: "approve_proposal",
            args: [xdr.ScVal.scvBytes(new Uint8Array(bindingHash))],
          })
        ),
        subInvocations: [],
      }),
    });
  };

  // Mock Freighter
  const mockFreighter = vi.fn().mockImplementation(async (xdrStr: string) => {
    return { signedTxXdr: xdrStr };
  });

  // Mock RPC Server
  const createMockRpc = (overrides: Record<string, any> = {}) => {
    return {
      getAccount: vi.fn().mockResolvedValue({ sequence: "100" }),
      simulateTransaction: vi.fn().mockImplementation(async (tx: any) => {
        if (overrides.simulateError) {
          return { error: overrides.simulateError };
        }
        return createMockSimulation(
          overrides.simulatedAuth || [],
          overrides.simulatedRetval || xdr.ScVal.scvVoid()
        );
      }),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: dummyTxHash,
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
      }),
      ...overrides,
    } as unknown as rpc.Server;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Role Detection", () => {
    it("blocks non-signer before simulation or signing", async () => {
      const mockRpc = createMockRpc();
      const mockSignerRpc = {
        ...mockRpc,
        simulateTransaction: vi.fn().mockResolvedValue({
          _parsed: true,
          transactionData: { build: () => ({}) },
          result: {
            retval: nativeToScVal([signerAddress]),
          },
        }),
      } as unknown as rpc.Server;

      await expect(
        approveProposal(1, {
          signerAddress: nonSignerAddress,
          contractId,
          signerSetHash,
          customRpcServer: mockSignerRpc,
          freighterSigner: mockFreighter,
        })
      ).rejects.toThrow("Action blocked: connected address is not a registered multisig signer.");

      expect(mockFreighter).not.toHaveBeenCalled();
    });
  });

  describe("Approval Domain-Bound Auth Verification", () => {
    it("approves proposal when domain binding matches simulation", async () => {
      const expectedBinding = computeApprovalBindingHash(contractId, 1, signerAddress, signerSetHash);
      const mockAuthEntry = createMockAuthEntry(expectedBinding, contractId, signerAddress);

      const mockRpc = createMockRpc({
        simulatedAuth: [mockAuthEntry],
      });

      const res = await approveProposal(1, {
        signerAddress,
        contractId,
        signerSetHash,
        knownSigners: [signerAddress],
        customRpcServer: mockRpc,
        freighterSigner: mockFreighter,
      });

      expect(res.status).toBe("confirmed");
      expect(res.txHash).toBe(dummyTxHash);
      expect(mockFreighter).toHaveBeenCalledOnce();
    });

    it("aborts approval when binding hash does not match (deliberately wrong signer-set hash)", async () => {
      const fakeSignerSetHash = "99".repeat(32);
      const legitimateBinding = computeApprovalBindingHash(contractId, 1, signerAddress, signerSetHash);
      const mockAuthEntry = createMockAuthEntry(legitimateBinding, contractId, signerAddress);

      const mockRpc = createMockRpc({
        simulatedAuth: [mockAuthEntry],
      });

      // Flow must abort before Freighter is opened
      await expect(
        approveProposal(1, {
          signerAddress,
          contractId,
          signerSetHash: fakeSignerSetHash, // wrong hash
          knownSigners: [signerAddress],
          customRpcServer: mockRpc,
          freighterSigner: mockFreighter,
        })
      ).rejects.toThrow("Approval binding mismatch");

      expect(mockFreighter).not.toHaveBeenCalled();
    });
  });

  describe("Proposal Execution & Batch Execution", () => {
    it("executes proposal with payload hash", async () => {
      const payloadHash = "0x" + "44".repeat(32);
      const mockRpc = createMockRpc();

      const res = await executeProposal(1, payloadHash, {
        signerAddress,
        contractId,
        knownSigners: [signerAddress],
        customRpcServer: mockRpc,
        freighterSigner: mockFreighter,
      });

      expect(res.status).toBe("confirmed");
      expect(res.txHash).toBe(dummyTxHash);
      expect(mockFreighter).toHaveBeenCalledOnce();
    });

    it("executes atomic batch of proposals (<= 32)", async () => {
      const ids = [1, 2, 3];
      const hashes = ["0x" + "11".repeat(32), "0x" + "22".repeat(32), "0x" + "33".repeat(32)];
      const mockRpc = createMockRpc();

      const res = await batchExecuteProposals(ids, hashes, {
        signerAddress,
        contractId,
        knownSigners: [signerAddress],
        customRpcServer: mockRpc,
        freighterSigner: mockFreighter,
      });

      expect(res.status).toBe("confirmed");
      expect(res.txHash).toBe(dummyTxHash);
      expect(mockFreighter).toHaveBeenCalledOnce();
    });

    it("rejects batch execution when selection exceeds 32 proposals", async () => {
      const ids = Array.from({ length: 33 }, (_, i) => i + 1);
      const hashes = Array.from({ length: 33 }, () => "0x" + "00".repeat(32));
      const mockRpc = createMockRpc();

      await expect(
        batchExecuteProposals(ids, hashes, {
          signerAddress,
          contractId,
          knownSigners: [signerAddress],
          customRpcServer: mockRpc,
          freighterSigner: mockFreighter,
        })
      ).rejects.toThrow("Batch size exceeds maximum limit of 32 proposals.");

      expect(mockFreighter).not.toHaveBeenCalled();
    });

    it("rejects empty batch execution", async () => {
      const mockRpc = createMockRpc();
      await expect(
        batchExecuteProposals([], [], {
          signerAddress,
          contractId,
          knownSigners: [signerAddress],
          customRpcServer: mockRpc,
          freighterSigner: mockFreighter,
        })
      ).rejects.toThrow("No proposals selected for batch execution.");
    });
  });

  describe("Proposal Cancellation", () => {
    it("cancels proposal", async () => {
      const mockRpc = createMockRpc();

      const res = await cancelProposal(5, {
        signerAddress,
        contractId,
        knownSigners: [signerAddress],
        customRpcServer: mockRpc,
        freighterSigner: mockFreighter,
      });

      expect(res.status).toBe("confirmed");
      expect(res.txHash).toBe(dummyTxHash);
    });
  });

  describe("Error Handling, User Rejection & Polling", () => {
    it("handles Freighter signature rejection by user", async () => {
      const rejectingFreighter = vi.fn().mockResolvedValue({
        error: "User rejected transaction signature",
      });

      const mockRpc = createMockRpc();

      await expect(
        executeProposal(1, "0x" + "00".repeat(32), {
          signerAddress,
          contractId,
          knownSigners: [signerAddress],
          customRpcServer: mockRpc,
          freighterSigner: rejectingFreighter,
        })
      ).rejects.toThrow("User rejected transaction signature");
    });

    it("handles on-chain FAILED transaction status", async () => {
      const mockRpc = createMockRpc({
        getTransaction: vi.fn().mockResolvedValue({
          status: rpc.Api.GetTransactionStatus.FAILED,
          resultXdr: {
            toXDR: () => "Error(Contract, #8)", // QuorumNotReached
          },
        }),
      });

      await expect(
        executeProposal(1, "0x" + "00".repeat(32), {
          signerAddress,
          contractId,
          knownSigners: [signerAddress],
          customRpcServer: mockRpc,
          freighterSigner: mockFreighter,
        })
      ).rejects.toThrow(MULTISIG_ERROR_MESSAGES.QuorumNotReached);
    });

    it("handles transaction confirmation timeout", async () => {
      const slowRpc = {
        getTransaction: vi.fn().mockResolvedValue({
          status: "NOT_FOUND",
        }),
      } as unknown as rpc.Server;

      await expect(
        pollTransactionStatus(dummyTxHash, slowRpc, 100, 20)
      ).rejects.toThrow(`Transaction timed out while waiting for confirmation: ${dummyTxHash}`);
    });

    it("correctly maps all known MultisigError codes and strings", () => {
      expect(parseMultisigError("ContractError: AlreadyApproved")).toBe(
        MULTISIG_ERROR_MESSAGES.AlreadyApproved
      );
      expect(parseMultisigError("ContractError: ProposalExpired")).toBe(
        MULTISIG_ERROR_MESSAGES.ProposalExpired
      );
      expect(parseMultisigError("ContractError: SignerSetChanged")).toBe(
        MULTISIG_ERROR_MESSAGES.SignerSetChanged
      );
      expect(parseMultisigError("ContractError: PayloadHashMismatch")).toBe(
        MULTISIG_ERROR_MESSAGES.PayloadHashMismatch
      );
      expect(parseMultisigError("ContractError: QuorumNotReached")).toBe(
        MULTISIG_ERROR_MESSAGES.QuorumNotReached
      );

      // Numeric error code parsing
      expect(parseMultisigError("HostError: Error(Contract, #6)")).toBe(
        MULTISIG_ERROR_MESSAGES.AlreadyApproved
      );
      expect(parseMultisigError("HostError: Error(Contract, #4)")).toBe(
        MULTISIG_ERROR_MESSAGES.ProposalExpired
      );
      expect(parseMultisigError("HostError: Error(Contract, #18)")).toBe(
        MULTISIG_ERROR_MESSAGES.SignerSetChanged
      );
    });
  });
});
