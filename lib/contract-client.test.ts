// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serverConstructor: vi.fn(),
  simulateTransaction: vi.fn(),
  getAccount: vi.fn(),
  prepareTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  getTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();

  class MockServer {
    constructor(url: string, options: { allowHttp: boolean }) {
      mocks.serverConstructor(url, options);
    }

    simulateTransaction(...args: unknown[]) {
      return mocks.simulateTransaction(...args);
    }

    getAccount(...args: unknown[]) {
      return mocks.getAccount(...args);
    }

    prepareTransaction(...args: unknown[]) {
      return mocks.prepareTransaction(...args);
    }

    sendTransaction(...args: unknown[]) {
      return mocks.sendTransaction(...args);
    }

    getTransaction(...args: unknown[]) {
      return mocks.getTransaction(...args);
    }
  }

  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: MockServer,
    },
  };
});

vi.mock("@/lib/config", () => ({
  config: {
    rpc: "https://rpc.example.org",
    networkPassphrase: "Test Network",
    lendingId: "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6",
  },
}));

import {
  Account,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  get_health_factor,
  get_pause_state,
  get_position,
  get_protocol_metrics,
  pauseTypeToScVal,
  readContract,
  set_pause,
  type PauseType,
} from "./contract-client";

const CONTRACT_ID = "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6";
const USER_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const successResponse = (retval: xdr.ScVal) =>
  ({
    _parsed: true,
    latestLedger: 100,
    result: {
      auth: [],
      retval,
    },
  }) as unknown as rpc.Api.SimulateTransactionResponse;

function invokeContract(tx: unknown) {
  const transaction = tx as {
    operations: Array<{
      func: {
        invokeContract: {
          functionName: { toString(): string };
          args: xdr.ScVal[];
        };
      };
    }>;
  };
  return transaction.operations[0]?.func.invokeContract;
}

describe("lib/contract-client", () => {
  beforeEach(() => {
    mocks.serverConstructor.mockClear();
    mocks.simulateTransaction.mockReset().mockResolvedValue(
      successResponse(nativeToScVal(42n, { type: "i128" })),
    );
    mocks.getAccount.mockReset();
    mocks.prepareTransaction.mockReset().mockImplementation(async (tx) => tx);
    mocks.sendTransaction.mockReset().mockResolvedValue({
      hash: "test-transaction-hash",
      status: "PENDING",
    });
    mocks.getTransaction.mockReset().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
    });
  });

  describe("pauseTypeToScVal", () => {
    it("encodes pause type symbols and symbol vectors", () => {
      const symbol = pauseTypeToScVal("Deposit");
      const vector = pauseTypeToScVal("Deposit", true);

      expect(scValToNative(symbol)).toBe("Deposit");
      expect(scValToNative(vector)).toEqual(["Deposit"]);
    });

    it("throws when the pause type cannot be encoded", () => {
      expect(() =>
        pauseTypeToScVal(42 as unknown as PauseType),
      ).toThrow();
    });
  });

  describe("readContract", () => {
    it("decodes i128 results and preserves argument order", async () => {
      const args = [
        nativeToScVal(7n, { type: "i128" }),
        nativeToScVal("deposit", { type: "symbol" }),
      ];
      const returnValue = nativeToScVal(123_456n, { type: "i128" });
      mocks.simulateTransaction.mockResolvedValue(
        successResponse(returnValue),
      );

      await expect(
        readContract("get_balance", args, CONTRACT_ID, "https://rpc.example.org"),
      ).resolves.toBe(123_456n);

      const tx = mocks.simulateTransaction.mock.calls[0]?.[0];
      expect(invokeContract(tx)?.functionName.toString()).toBe("get_balance");
      expect(invokeContract(tx)?.args).toEqual(args);
      expect(mocks.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it("surfaces the simulation error text", async () => {
      mocks.simulateTransaction.mockResolvedValue({
        _parsed: true,
        error: "HostError: Error(Contract, #2007)",
      });

      await expect(
        readContract("get_balance", [], CONTRACT_ID, "https://rpc.example.org"),
      ).rejects.toThrow(
        "Simulation error calling get_balance: HostError: Error(Contract, #2007)",
      );
    });

    it("rejects missing or invalid contract ids before making an RPC call", async () => {
      await expect(
        readContract("get_balance", [], "", "https://rpc.example.org"),
      ).rejects.toThrow("Invalid contract ID:");
      await expect(
        readContract("get_balance", [], "not-a-contract", "https://rpc.example.org"),
      ).rejects.toThrow("Invalid contract ID: not-a-contract");

      expect(mocks.serverConstructor).not.toHaveBeenCalled();
      expect(mocks.simulateTransaction).not.toHaveBeenCalled();
    });
  });

  describe("get_position", () => {
    it("decodes position amounts", async () => {
      mocks.simulateTransaction.mockResolvedValue(
        successResponse(
          nativeToScVal(
            { collateral: 50_000_000n, debt: 20_000_000n },
          ),
        ),
      );

      await expect(
        get_position(USER_ADDRESS, CONTRACT_ID, "https://rpc.example.org"),
      ).resolves.toMatchObject({
        collateral: 50_000_000n,
        debt: 20_000_000n,
      });

      const tx = mocks.simulateTransaction.mock.calls[0]?.[0];
      expect(invokeContract(tx)?.functionName.toString()).toBe("get_position");
      expect(invokeContract(tx)?.args).toHaveLength(1);
      expect(mocks.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it("rejects an unexpected response format", async () => {
      mocks.simulateTransaction.mockResolvedValue(
        successResponse(nativeToScVal("unexpected")),
      );

      await expect(
        get_position(USER_ADDRESS, CONTRACT_ID, "https://rpc.example.org"),
      ).rejects.toThrow("Unexpected get_position response format");
    });
  });

  describe("get_health_factor", () => {
    it("decodes an i128 health factor as bigint", async () => {
      mocks.simulateTransaction.mockResolvedValue(
        successResponse(nativeToScVal(20_000n, { type: "i128" })),
      );

      await expect(
        get_health_factor(USER_ADDRESS, CONTRACT_ID, "https://rpc.example.org"),
      ).resolves.toBe(20_000n);

      const tx = mocks.simulateTransaction.mock.calls[0]?.[0];
      expect(invokeContract(tx)?.functionName.toString()).toBe(
        "get_health_factor",
      );
      expect(invokeContract(tx)?.args).toHaveLength(1);
    });

    it("rejects an unsupported return value", async () => {
      mocks.simulateTransaction.mockResolvedValue(
        successResponse(nativeToScVal(true)),
      );

      await expect(
        get_health_factor(USER_ADDRESS, CONTRACT_ID, "https://rpc.example.org"),
      ).rejects.toThrow("Unexpected get_health_factor response format");
    });
  });

  describe("get_protocol_metrics", () => {
    it("decodes supply and borrow totals", async () => {
      mocks.simulateTransaction.mockResolvedValue(
        successResponse(
          nativeToScVal(
            { total_supply: 1_000n, total_borrow: 250n },
          ),
        ),
      );

      await expect(
        get_protocol_metrics(CONTRACT_ID, "https://rpc.example.org"),
      ).resolves.toMatchObject({
        totalSupply: 1_000n,
        totalBorrow: 250n,
      });

      const tx = mocks.simulateTransaction.mock.calls[0]?.[0];
      expect(invokeContract(tx)?.functionName.toString()).toBe(
        "get_protocol_metrics",
      );
      expect(invokeContract(tx)?.args).toEqual([]);
    });

    it("rejects an unsupported return value", async () => {
      mocks.simulateTransaction.mockResolvedValue(
        successResponse(nativeToScVal("unexpected")),
      );

      await expect(
        get_protocol_metrics(CONTRACT_ID, "https://rpc.example.org"),
      ).rejects.toThrow("Unexpected get_protocol_metrics response format");
    });
  });

  describe("get_pause_state", () => {
    it("decodes a pause-state boolean", async () => {
      mocks.simulateTransaction.mockResolvedValue(
        successResponse(nativeToScVal(true)),
      );

      await expect(
        get_pause_state("Borrow", CONTRACT_ID, "https://rpc.example.org"),
      ).resolves.toBe(true);

      const tx = mocks.simulateTransaction.mock.calls[0]?.[0];
      expect(invokeContract(tx)?.functionName.toString()).toBe(
        "get_pause_state",
      );
      expect(invokeContract(tx)?.args.map((arg) => scValToNative(arg))).toEqual([
        "Borrow",
      ]);
    });

    it("rethrows the fallback simulation error", async () => {
      mocks.simulateTransaction.mockRejectedValue(new Error("RPC unavailable"));

      await expect(
        get_pause_state("Borrow", CONTRACT_ID, "https://rpc.example.org"),
      ).rejects.toThrow("RPC unavailable");
      expect(mocks.simulateTransaction).toHaveBeenCalledTimes(2);
      const firstTx = mocks.simulateTransaction.mock.calls[0]?.[0];
      const secondTx = mocks.simulateTransaction.mock.calls[1]?.[0];
      expect(
        invokeContract(firstTx)?.args.map((arg) => scValToNative(arg)),
      ).toEqual(["Borrow"]);
      expect(
        invokeContract(secondTx)?.args.map((arg) => scValToNative(arg)),
      ).toEqual([["Borrow"]]);
    });
  });

  describe("set_pause", () => {
    it("simulates, prepares, submits, and confirms the pause update", async () => {
      const adminKeypair = Keypair.random();
      mocks.getAccount.mockResolvedValue(
        new Account(adminKeypair.publicKey(), "100"),
      );

      await expect(
        set_pause(
          adminKeypair,
          "Withdraw",
          true,
          CONTRACT_ID,
          "https://rpc.example.org",
          "Test Network",
        ),
      ).resolves.toBe("test-transaction-hash");

      const tx = mocks.simulateTransaction.mock.calls[0]?.[0];
      expect(invokeContract(tx)?.functionName.toString()).toBe("set_pause");
      expect(
        invokeContract(tx)?.args.map((arg) => scValToNative(arg)),
      ).toEqual([adminKeypair.publicKey(), "Withdraw", true]);
      expect(mocks.getAccount).toHaveBeenCalledWith(adminKeypair.publicKey());
      expect(mocks.prepareTransaction).toHaveBeenCalledTimes(1);
      expect(mocks.sendTransaction).toHaveBeenCalledTimes(1);
      expect(mocks.getTransaction).toHaveBeenCalledWith(
        "test-transaction-hash",
      );
    });

    it("rejects an invalid contract id before any RPC call", async () => {
      const adminKeypair = Keypair.random();

      await expect(
        set_pause(adminKeypair, "Withdraw", true, "invalid-id"),
      ).rejects.toThrow("Invalid contract ID: invalid-id");

      expect(mocks.serverConstructor).not.toHaveBeenCalled();
      expect(mocks.getAccount).not.toHaveBeenCalled();
      expect(mocks.simulateTransaction).not.toHaveBeenCalled();
    });

    it("propagates account lookup failures", async () => {
      const adminKeypair = Keypair.random();
      mocks.getAccount.mockRejectedValue(new Error("account lookup failed"));

      await expect(
        set_pause(
          adminKeypair,
          "Withdraw",
          true,
          CONTRACT_ID,
          "https://rpc.example.org",
          "Test Network",
        ),
      ).rejects.toThrow("account lookup failed");
      expect(mocks.getAccount).toHaveBeenCalledTimes(1);
      expect(mocks.simulateTransaction).not.toHaveBeenCalled();
    });
  });
});
