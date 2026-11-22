import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rpc, StrKey } from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { config } from "./config";
import {
  pollTransactionStatus,
  executeContractCall,
  buildLiquidateTransaction,
  signWithFreighter,
  submitTransaction,
  executeLiquidation,
  parseContractError,
} from "./tx";

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      assembleTransaction: vi.fn(),
    },
  };
});

const TEST_SIGNER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const TEST_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));

function createMockServer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getAccount: vi.fn().mockResolvedValue({ sequence: "100" }),
    simulateTransaction: vi.fn().mockResolvedValue({
      id: "sim-1",
      latestLedger: 1,
      events: [],
      transactionData: {},
      minResourceFee: "100",
      _parsed: true,
      result: { auth: [], retval: {} },
    }),
    sendTransaction: vi.fn().mockResolvedValue({
      status: "PENDING",
      hash: "tx-hash-123",
    }),
    getTransaction: vi.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
      ledger: 42,
    }),
    ...overrides,
  } as unknown as rpc.Server;
}

describe("lib/tx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("pollTransactionStatus", () => {
    it("poll resolves on SUCCESS", async () => {
      vi.useFakeTimers();
      const getTransaction = vi
        .fn()
        .mockResolvedValueOnce({ status: rpc.Api.GetTransactionStatus.NOT_FOUND })
        .mockResolvedValueOnce({
          status: rpc.Api.GetTransactionStatus.SUCCESS,
          ledger: 123,
        });
      const server = createMockServer({ getTransaction });

      const promise = pollTransactionStatus("hash-ok", server, 500, 5000);
      await vi.advanceTimersByTimeAsync(500);
      const res = await promise;

      expect(res.status).toBe(rpc.Api.GetTransactionStatus.SUCCESS);
      expect(getTransaction).toHaveBeenCalledTimes(2);
      expect(getTransaction).toHaveBeenCalledWith("hash-ok");
    });

    it("poll throws on FAILED with base64 XDR", async () => {
      const server = createMockServer({
        getTransaction: vi.fn().mockResolvedValue({
          status: rpc.Api.GetTransactionStatus.FAILED,
          resultXdr: {
            toXDR: (fmt: string) => (fmt === "base64" ? "AAAA_FAILED_XDR==" : ""),
          },
        }),
      });

      await expect(
        pollTransactionStatus("hash-fail", server, 100, 5000)
      ).rejects.toThrow("Transaction failed on-chain: AAAA_FAILED_XDR==");
    });

    it("poll throws on FAILED with fallback message when resultXdr is absent", async () => {
      const server = createMockServer({
        getTransaction: vi.fn().mockResolvedValue({
          status: rpc.Api.GetTransactionStatus.FAILED,
        }),
      });

      await expect(
        pollTransactionStatus("hash-fail-no-xdr", server, 100, 5000)
      ).rejects.toThrow("Transaction failed on-chain: Transaction execution failed");
    });

    it("poll times out after timeoutMs", async () => {
      vi.useFakeTimers();
      const server = createMockServer({
        getTransaction: vi.fn().mockResolvedValue({
          status: rpc.Api.GetTransactionStatus.NOT_FOUND,
        }),
      });

      const promise = pollTransactionStatus("hash-timeout", server, 500, 1500);
      const rejection = expect(promise).rejects.toThrow(
        "Transaction timed out while waiting for confirmation: hash-timeout"
      );
      await vi.advanceTimersByTimeAsync(2000);
      await rejection;
    });
  });

  describe("executeContractCall", () => {
    it("executes full flow and calls Freighter with network passphrase from config", async () => {
      const server = createMockServer();
      const mockPreparedTx = {
        toXDR: vi.fn().mockReturnValue("UNSIGNED_XDR_DATA"),
      };
      vi.mocked(rpc.assembleTransaction).mockReturnValue({
        build: () => mockPreparedTx,
      } as unknown as ReturnType<typeof rpc.assembleTransaction>);
      vi.mocked(signTransaction).mockResolvedValue({
        signedTxXdr: "SIGNED_XDR_DATA",
      } as unknown as Awaited<ReturnType<typeof signTransaction>>);

      const res = await executeContractCall("deposit", [], {
        signerAddress: TEST_SIGNER,
        contractId: TEST_CONTRACT_ID,
        customRpcServer: server,
        pollIntervalMs: 10,
        timeoutMs: 1000,
      });

      expect(res.txHash).toBe("tx-hash-123");
      expect(res.status).toBe("confirmed");
      expect(signTransaction).toHaveBeenCalledTimes(1);
      expect(signTransaction).toHaveBeenCalledWith("UNSIGNED_XDR_DATA", {
        networkPassphrase: config.networkPassphrase,
      });
      expect(server.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("execute aborts when simulation fails and decodes known contract error", async () => {
      const server = createMockServer({
        simulateTransaction: vi.fn().mockResolvedValue({
          id: "sim-err",
          latestLedger: 1,
          error: "HostError: Error(Contract, #1003)",
        }),
      });

      await expect(
        executeContractCall("admin_action", [], {
          signerAddress: TEST_SIGNER,
          contractId: TEST_CONTRACT_ID,
          customRpcServer: server,
        })
      ).rejects.toThrow("Your wallet is not authorized for this action.");

      expect(signTransaction).not.toHaveBeenCalled();
      expect(server.sendTransaction).not.toHaveBeenCalled();
    });

    it("aborts before signing when verifyCallerRole rejects", async () => {
      const server = createMockServer();
      const verifyCallerRole = vi
        .fn()
        .mockRejectedValue(new Error("Caller is not admin"));

      await expect(
        executeContractCall("pause", [], {
          signerAddress: TEST_SIGNER,
          contractId: TEST_CONTRACT_ID,
          customRpcServer: server,
          verifyCallerRole,
        })
      ).rejects.toThrow("Caller is not admin");

      expect(verifyCallerRole).toHaveBeenCalledTimes(1);
      expect(server.simulateTransaction).not.toHaveBeenCalled();
      expect(signTransaction).not.toHaveBeenCalled();
      expect(server.sendTransaction).not.toHaveBeenCalled();
    });

    it("throws when Freighter declines signature", async () => {
      const server = createMockServer();
      vi.mocked(rpc.assembleTransaction).mockReturnValue({
        build: () => ({ toXDR: () => "UNSIGNED_XDR_DATA" }),
      } as unknown as ReturnType<typeof rpc.assembleTransaction>);
      vi.mocked(signTransaction).mockResolvedValue({
        error: "User declined access",
      } as unknown as Awaited<ReturnType<typeof signTransaction>>);

      await expect(
        executeContractCall("deposit", [], {
          signerAddress: TEST_SIGNER,
          contractId: TEST_CONTRACT_ID,
          customRpcServer: server,
        })
      ).rejects.toThrow("The request was cancelled in your wallet.");

      expect(server.sendTransaction).not.toHaveBeenCalled();
    });

    it("throws on ERROR status from sendTransaction", async () => {
      const server = createMockServer({
        sendTransaction: vi.fn().mockResolvedValue({
          status: "ERROR",
          errorResult: {
            toXDR: () => "ERROR_RESULT_XDR",
          },
        }),
      });
      vi.mocked(rpc.assembleTransaction).mockReturnValue({
        build: () => ({ toXDR: () => "UNSIGNED_XDR_DATA" }),
      } as unknown as ReturnType<typeof rpc.assembleTransaction>);
      vi.mocked(signTransaction).mockResolvedValue({
        signedTxXdr: "SIGNED_XDR_DATA",
      } as unknown as Awaited<ReturnType<typeof signTransaction>>);

      await expect(
        executeContractCall("deposit", [], {
          signerAddress: TEST_SIGNER,
          contractId: TEST_CONTRACT_ID,
          customRpcServer: server,
        })
      ).rejects.toThrow("The request could not be completed.");

      expect(server.getTransaction).not.toHaveBeenCalled();
    });
  });

  describe("liquidation helpers", () => {
    it("buildLiquidateTransaction, signWithFreighter, submitTransaction, and executeLiquidation", async () => {
      const params = {
        liquidator: TEST_SIGNER,
        borrower: TEST_SIGNER,
        debtAsset: "USDC",
        collateralAsset: "XLM",
        amount: BigInt(1000),
        contractId: TEST_CONTRACT_ID,
      };

      const unsignedXdr = await buildLiquidateTransaction(params);
      expect(unsignedXdr).toContain("mock_unsigned_xdr_");

      const signedXdr = await signWithFreighter(unsignedXdr);
      expect(signedXdr).toBe(`mock_signed_xdr_${unsignedXdr}`);

      const hash = await submitTransaction(signedXdr);
      expect(hash).toMatch(/^test_tx_hash_\d+$/);

      const result = await executeLiquidation(params);
      expect(result.status).toBe("success");
      expect(result.hash).toMatch(/^test_tx_hash_\d+$/);
    });
  });

  describe("parseContractError", () => {
    it("maps known lending contract error names from strings and Error instances", () => {
      expect(parseContractError("Contract failed: PositionHealthy")).toBe(
        "Position is healthy and cannot be liquidated"
      );
      expect(parseContractError("SelfLiquidation not allowed")).toBe(
        "Cannot liquidate your own position"
      );
      expect(parseContractError(new Error("StaleOracleTimestamp"))).toBe(
        "Oracle price data is stale; please try again later"
      );
      expect(parseContractError(new Error("OperationPaused"))).toBe(
        "Liquidation operations are currently paused"
      );
    });

    it("returns generic string for unknown input", () => {
      expect(parseContractError("SomeUnrecognizedError")).toBe(
        "Unknown contract error"
      );
      expect(parseContractError(null)).toBe("Unknown contract error");
      expect(parseContractError(undefined)).toBe("Unknown contract error");
      expect(parseContractError({ code: 9999 })).toBe("Unknown contract error");
    });
  });
});
