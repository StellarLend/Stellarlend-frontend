import { describe, it, expect, vi } from "vitest";
import { rpc, StrKey, xdr } from "@stellar/stellar-sdk";
import { simulateRead } from "./soroban";

const VALID_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32));

function makeMockRpcServer(
  response: Partial<rpc.Api.SimulateTransactionResponse>
): rpc.Server {
  return {
    simulateTransaction: vi.fn().mockResolvedValue(response),
  } as unknown as rpc.Server;
}

describe("simulateRead", () => {
  it("returns native value on success", async () => {
    const retval = xdr.ScVal.scvU32(42);
    const mockResponse = {
      id: "1",
      latestLedger: 100,
      events: [],
      result: {
        retval,
        auth: [],
      },
      transactionData: {} as unknown as xdr.SorobanTransactionData,
      minResourceFee: "100",
    } as unknown as rpc.Api.SimulateTransactionSuccessResponse;

    const customRpcServer = makeMockRpcServer(mockResponse);
    const res = await simulateRead<number>(VALID_CONTRACT_ID, "get_balance", [], {
      customRpcServer,
    });

    expect(res.result).toBe(retval);
    expect(res.native).toBe(42);
    expect(res.raw).toBe(mockResponse);
  });

  it("throws 'Simulation error' when simulation fails", async () => {
    const mockErrorResponse = {
      id: "2",
      latestLedger: 100,
      events: [],
      error: "HostError: Error(Contract, #1)",
    } as unknown as rpc.Api.SimulateTransactionErrorResponse;

    const customRpcServer = makeMockRpcServer(mockErrorResponse);

    await expect(
      simulateRead(VALID_CONTRACT_ID, "get_balance", [], { customRpcServer })
    ).rejects.toThrow("Simulation error for get_balance: HostError: Error(Contract, #1)");
  });

  it("throws 'Simulation error' when simulation succeeds without retval", async () => {
    const mockNoRetvalResponse = {
      id: "3",
      latestLedger: 100,
      events: [],
      transactionData: {} as unknown as xdr.SorobanTransactionData,
      minResourceFee: "100",
    } as unknown as rpc.Api.SimulateTransactionSuccessResponse;

    const customRpcServer = makeMockRpcServer(mockNoRetvalResponse);

    await expect(
      simulateRead(VALID_CONTRACT_ID, "get_balance", [], { customRpcServer })
    ).rejects.toThrow("Simulation error for get_balance: Simulation returned error or no retval");
  });
});
