// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { setPause, setEmergencyState } from "./admin";
import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";

describe("mocked Freighter and RPC submission tests", () => {
  const TEST_CALLER = "GAH5NAPXT6T4Z6VUGGVIVTUT6I6JNDMBTKA4VYIUYZLTNZ2FW6NRGLJX";
  const TEST_CONTRACT = "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6";

  const createMockSimulation = (retval = xdr.ScVal.scvVoid()) => {
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
        auth: [],
        retval,
      },
    };
  };

  it("submits set_pause with exact PauseType ScVal vec, boolean, and u32 ttl args", async () => {
    let capturedMethod = "";
    let capturedArgs: xdr.ScVal[] = [];

    const mockRpcServer = {
      getAccount: vi.fn().mockResolvedValue({ sequence: "100" }),
      simulateTransaction: vi.fn().mockImplementation((tx: any) => {
        const op = tx.operations[0];
        capturedMethod = op.func.invokeContract.functionName.toString();
        capturedArgs = op.func.invokeContract.args;
        return Promise.resolve(createMockSimulation());
      }),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: "a".repeat(64),
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
      }),
    } as unknown as rpc.Server;

    const mockFreighter = vi.fn().mockImplementation((txXdr: string) => {
      // Mock freighter signature returning valid signed transaction XDR
      return Promise.resolve(txXdr);
    });

    const res = await setPause("Deposit", true, 720, {
      signerAddress: TEST_CALLER,
      contractId: TEST_CONTRACT,
      customRpcServer: mockRpcServer,
      freighterSigner: mockFreighter,
    });

    expect(res.txHash).toBe("a".repeat(64));
    expect(res.status).toBe("confirmed");

    // Verify exact contract invocation name
    expect(capturedMethod).toBe("set_pause");
    expect(capturedArgs.length).toBe(3);

    // Verify PauseType enum encoded as ScVal vec with symbol
    const [pauseTypeArg, pausedArg, ttlArg] = capturedArgs as any[];
    expect(pauseTypeArg.type).toBe("scvVec");
    expect(pauseTypeArg.vec?.length).toBe(1);
    expect(pauseTypeArg.vec?.[0].type).toBe("scvSymbol");
    expect(pauseTypeArg.vec?.[0].sym.toString()).toBe("Deposit");
    expect(scValToNative(pauseTypeArg)).toEqual(["Deposit"]);

    // Verify boolean paused
    expect(pausedArg.type).toBe("scvBool");
    expect(pausedArg.b).toBe(true);

    // Verify u32 ttl
    expect(ttlArg.type).toBe("scvU32");
    expect(ttlArg.u32).toBe(720);

    // Verify freighter was invoked
    expect(mockFreighter).toHaveBeenCalledTimes(1);
  });

  it("submits set_emergency_state with exact EmergencyState ScVal vec with symbol", async () => {
    let capturedMethod = "";
    let capturedArgs: xdr.ScVal[] = [];

    const mockRpcServer = {
      getAccount: vi.fn().mockResolvedValue({ sequence: "101" }),
      simulateTransaction: vi.fn().mockImplementation((tx: any) => {
        const op = tx.operations[0];
        capturedMethod = op.func.invokeContract.functionName.toString();
        capturedArgs = op.func.invokeContract.args;
        return Promise.resolve(createMockSimulation());
      }),
      sendTransaction: vi.fn().mockResolvedValue({
        status: "PENDING",
        hash: "b".repeat(64),
      }),
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
      }),
    } as unknown as rpc.Server;

    const mockFreighter = vi.fn().mockImplementation((txXdr: string) => {
      return Promise.resolve(txXdr);
    });

    const res = await setEmergencyState("Shutdown", {
      signerAddress: TEST_CALLER,
      contractId: TEST_CONTRACT,
      customRpcServer: mockRpcServer,
      freighterSigner: mockFreighter,
    });

    expect(res.txHash).toBe("b".repeat(64));
    expect(res.status).toBe("confirmed");

    // Verify exact contract invocation name
    expect(capturedMethod).toBe("set_emergency_state");
    expect(capturedArgs.length).toBe(1);

    // Verify EmergencyState enum encoded as ScVal vec with symbol
    const [stateArg] = capturedArgs as any[];
    expect(stateArg.type).toBe("scvVec");
    expect(stateArg.vec?.length).toBe(1);
    expect(stateArg.vec?.[0].type).toBe("scvSymbol");
    expect(stateArg.vec?.[0].sym.toString()).toBe("Shutdown");
    expect(scValToNative(stateArg)).toEqual(["Shutdown"]);
  });

  it("decodes Unauthorized error code 1003 into human-readable message", async () => {
    const mockRpcServer = {
      getAccount: vi.fn().mockResolvedValue({ sequence: "102" }),
      simulateTransaction: vi.fn().mockResolvedValue({
        error: "HostError: Error(Contract, #1003)",
      }),
    } as unknown as rpc.Server;

    await expect(
      setEmergencyState("Shutdown", {
        signerAddress: TEST_CALLER,
        contractId: TEST_CONTRACT,
        customRpcServer: mockRpcServer,
        freighterSigner: vi.fn(),
      })
    ).rejects.toThrow("Your wallet is not authorized for this action.");
  });

  it("re-checks role before signing and aborts if disconnected or unauthorized", async () => {
    const mockRpcServer = {
      getAccount: vi.fn().mockResolvedValue({ sequence: "103" }),
      simulateTransaction: vi.fn().mockResolvedValue({
        result: { retval: xdr.ScVal.scvVoid() },
        minResourceFee: "100",
      }),
    } as unknown as rpc.Server;

    const mockFreighter = vi.fn();
    const verifyCallerRole = vi.fn().mockRejectedValue(
      new Error("Connected address is not authorized as protocol admin or guardian.")
    );

    await expect(
      setEmergencyState("Shutdown", {
        signerAddress: TEST_CALLER,
        contractId: TEST_CONTRACT,
        customRpcServer: mockRpcServer,
        freighterSigner: mockFreighter,
        verifyCallerRole,
      })
    ).rejects.toThrow("Connected address is not authorized as protocol admin or guardian.");

    expect(mockFreighter).not.toHaveBeenCalled();
  });
});
