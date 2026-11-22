// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";
import {
  SIMULATION_SOURCE_ACCOUNT,
  SimulationError,
  simulateContractRead,
  simulateRead,
} from "./soroban-read";

const CONTRACT_ID = "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6";

describe("lib/soroban-read", () => {
  it("returns native value, scVal and latestLedger on simulation success", async () => {
    const scVal = xdr.ScVal.scvU32(42);
    const mockServer = {
      simulateTransaction: vi.fn().mockResolvedValue({
        _parsed: true,
        latestLedger: 123456,
        result: {
          auth: [],
          retval: scVal,
        },
      }),
    } as unknown as rpc.Server;

    const res = await simulateRead<number>({
      contractId: CONTRACT_ID,
      method: "get_threshold",
      rpcServer: mockServer,
    });

    expect(res.native).toBe(42);
    expect(res.scVal).toBe(scVal);
    expect(res.latestLedger).toBe(123456);
    expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws SimulationError carrying method name, contractId and RPC error text", async () => {
    const mockServer = {
      simulateTransaction: vi.fn().mockResolvedValue({
        _parsed: true,
        error: "HostError: Error(Contract, #2)",
      }),
    } as unknown as rpc.Server;

    let caught: unknown;
    try {
      await simulateRead({
        contractId: CONTRACT_ID,
        method: "get_proposal",
        rpcServer: mockServer,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SimulationError);
    const simErr = caught as SimulationError;
    expect(simErr.method).toBe("get_proposal");
    expect(simErr.contractId).toBe(CONTRACT_ID);
    expect(simErr.rpcError).toBe("HostError: Error(Contract, #2)");
    expect(simErr.message).toContain("get_proposal");
    expect(simErr.message).toContain(CONTRACT_ID);
    expect(simErr.message).toContain("HostError: Error(Contract, #2)");
  });

  it("uses provided rpcUrl and network passphrase", async () => {
    const spy = vi
      .spyOn(rpc.Server.prototype, "simulateTransaction")
      .mockResolvedValue({
        _parsed: true,
        latestLedger: 999,
        result: {
          auth: [],
          retval: nativeToScVal("GADMIN"),
        },
      } as unknown as rpc.Api.SimulateTransactionResponse);

    try {
      const customUrl = "https://custom-rpc.example.org";
      const customPassphrase = "Custom Network ; 2026";
      const res = await simulateRead<string>({
        contractId: CONTRACT_ID,
        method: "get_admin",
        rpcUrl: customUrl,
        passphrase: customPassphrase,
      });

      expect(res.native).toBe("GADMIN");
      expect(res.latestLedger).toBe(999);
      expect(spy).toHaveBeenCalledTimes(1);
      const serverInstance = spy.mock.instances[0] as unknown as {
        serverURL: URL;
      };
      expect(serverInstance.serverURL.toString()).toContain("custom-rpc.example.org");
    } finally {
      spy.mockRestore();
    }
  });

  it("supports ScVal args and attaches operation metadata", async () => {
    const arg1 = nativeToScVal("token", { type: "symbol" });
    const arg2 = nativeToScVal(1000n, { type: "i128" });
    let capturedTx: unknown;

    const mockServer = {
      simulateTransaction: vi.fn().mockImplementation(async (tx: unknown) => {
        capturedTx = tx;
        return {
          _parsed: true,
          latestLedger: 500,
          result: {
            auth: [],
            retval: nativeToScVal(true),
          },
        };
      }),
    } as unknown as rpc.Server;

    const res = await simulateRead<boolean>({
      contractId: CONTRACT_ID,
      method: "check_params",
      args: [arg1, arg2],
      rpcServer: mockServer,
    });

    expect(res.native).toBe(true);
    const txObj = capturedTx as {
      source: string;
      operations: Array<{ function?: string; args?: xdr.ScVal[]; contract?: string }>;
    };
    expect(txObj.source).toBe(SIMULATION_SOURCE_ACCOUNT);
    expect(txObj.operations[0]?.function).toBe("check_params");
    expect(txObj.operations[0]?.args).toEqual([arg1, arg2]);
    expect(txObj.operations[0]?.contract).toBe(CONTRACT_ID);
  });

  it("supports optional per-call timeoutMs and AbortSignal", async () => {
    const slowServer = {
      simulateTransaction: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 500);
          }),
      ),
    } as unknown as rpc.Server;

    await expect(
      simulateRead({
        contractId: CONTRACT_ID,
        method: "slow_call",
        rpcServer: slowServer,
        timeoutMs: 20,
      }),
    ).rejects.toThrow(SimulationError);

    const controller = new AbortController();
    controller.abort(new Error("Caller cancelled read"));

    await expect(
      simulateRead({
        contractId: CONTRACT_ID,
        method: "aborted_call",
        rpcServer: slowServer,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/Caller cancelled read/);
  });

  it("supports legacy simulateContractRead wrapper", async () => {
    const spy = vi
      .spyOn(rpc.Server.prototype, "simulateTransaction")
      .mockResolvedValue({
        _parsed: true,
        latestLedger: 101,
        result: {
          auth: [],
          retval: xdr.ScVal.scvU32(99),
        },
      } as unknown as rpc.Api.SimulateTransactionResponse);

    try {
      const val = await simulateContractRead<number>(CONTRACT_ID, "get_count", []);
      expect(val).toBe(99);
    } finally {
      spy.mockRestore();
    }
  });
});
