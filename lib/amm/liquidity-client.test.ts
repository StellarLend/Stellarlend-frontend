import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolSnapshot } from "./liquidity-client";

const mocks = vi.hoisted(() => ({
  operations: [] as Array<{ method: string; args: unknown[] }>,
  network: "TESTNET",
  reserveA: 100_000n,
  reserveB: 200_000n,
  signResult: { signedTxXdr: "signed-xdr" } as { signedTxXdr?: string; error?: { message: string } },
  transactionResult: "SUCCESS" as "SUCCESS" | "FAILED" | "NOT_FOUND",
  sendTransaction: vi.fn(async (_transaction: unknown) => ({ hash: "test-hash", status: "PENDING" })),
  signTransaction: vi.fn(async (..._args: unknown[]): Promise<{ signedTxXdr?: string; error?: { message: string } }> => ({ signedTxXdr: "signed-xdr" })),
}));

vi.mock("@stellar/stellar-sdk", () => {
  class Address {
    constructor(private readonly value: string) {}
    toScVal() { return { address: this.value }; }
  }
  class Contract {
    constructor(private readonly contractId: string) {}
    call(method: string, ...args: unknown[]) {
      const operation = { method, args };
      mocks.operations.push(operation);
      return operation;
    }
  }
  class TransactionBuilder {
    private operation: { method: string; args: unknown[] } | null = null;
    constructor(_account: unknown, _options: unknown) {}
    addOperation(operation: { method: string; args: unknown[] }) { this.operation = operation; return this; }
    setTimeout(_seconds: number) { return this; }
    build() { return { operation: this.operation, toXDR: () => "transaction-xdr" }; }
    static fromXDR(_xdr: string, _passphrase: string) { return {}; }
  }
  const rpc = {
    Server: class {
      async getAccount(_address: string) { return {}; }
      async simulateTransaction(tx: { operation: { method: string } }) {
        const values: Record<string, unknown> = {
          get_reserves: [mocks.reserveA, mocks.reserveB],
          get_total_supply: 100_000n,
          get_lp_balance: 50_000n,
          get_min_liquidity: 0n,
          decimals: 7,
          balance: 1_000_000n,
        };
        return { result: { retval: { value: values[tx.operation.method] } } };
      }
      async prepareTransaction(tx: { toXDR: () => string }) { return tx; }
      async sendTransaction(tx: unknown) { return mocks.sendTransaction(tx); }
      async getTransaction(_hash: string) {
        return {
          status: mocks.transactionResult,
          resultXdr: { toXDR: () => "contract-error-xdr" },
        };
      }
    },
    Api: {
      isSimulationError: () => false,
      GetTransactionStatus: { SUCCESS: "SUCCESS", FAILED: "FAILED", NOT_FOUND: "NOT_FOUND" },
    },
  };
  return {
    Address,
    BASE_FEE: "100",
    Contract,
    Networks: { TESTNET: "testnet-passphrase", PUBLIC: "public-passphrase" },
    rpc,
    TransactionBuilder,
    nativeToScVal: (value: unknown) => ({ value }),
    scValToNative: (value: { value: unknown }) => value.value,
  };
});

vi.mock("@stellar/freighter-api", () => ({
  getNetwork: vi.fn(async () => ({
    network: mocks.network,
    networkPassphrase: mocks.network === "PUBLIC" ? "public-passphrase" : "testnet-passphrase",
  })),
  signTransaction: (...args: unknown[]) => mocks.signTransaction(...args),
}));

vi.mock("@/lib/config", () => ({
  config: {
    network: "testnet",
    horizon: "https://horizon-testnet.stellar.org",
    rpc: "https://soroban-testnet.stellar.org",
    ammId: "CAMM",
    ammTokenAId: "CTOKENA",
    ammTokenBId: "CTOKENB",
    ammTokenAHorizonAsset: "",
    ammTokenBHorizonAsset: "",
    networkPassphrase: "testnet-passphrase",
  },
}));

import { submitLiquidityAction } from "./liquidity-client";

const snapshot: PoolSnapshot = {
  reserveA: 100_000n,
  reserveB: 200_000n,
  totalSupply: 100_000n,
  minimumReserve: 0n,
  userShares: 50_000n,
  tokenA: { decimals: 7, balance: 1_000_000n, trustline: "active" },
  tokenB: { decimals: 7, balance: 1_000_000n, trustline: "active" },
};

describe("submitLiquidityAction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.operations.length = 0;
    mocks.network = "TESTNET";
    mocks.reserveA = 100_000n;
    mocks.reserveB = 200_000n;
    mocks.signResult = { signedTxXdr: "signed-xdr" };
    mocks.signTransaction.mockReset().mockImplementation(async () => mocks.signResult);
    mocks.sendTransaction.mockReset().mockResolvedValue({ hash: "test-hash", status: "PENDING" });
    mocks.transactionResult = "SUCCESS";
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ balances: [] }),
    })));
  });

  it("calls add_liquidity with caller and exact i128 amounts, then signs and submits", async () => {
    const result = await submitLiquidityAction(
      "GUSER",
      { kind: "add", amountA: 10_000n, amountB: 20_000n },
      snapshot,
      () => true,
    );
    const operation = mocks.operations.find((entry) => entry.method === "add_liquidity");
    expect(operation?.args).toEqual([{ address: "GUSER" }, { value: 10_000n }, { value: 20_000n }]);
    expect(mocks.signTransaction).toHaveBeenCalledWith("transaction-xdr", { networkPassphrase: "testnet-passphrase" });
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(1);
    expect(result).toBe("test-hash");
  });

  it("calls remove_liquidity with caller and exact LP shares", async () => {
    await submitLiquidityAction("GUSER", { kind: "remove", shares: 1_000n }, snapshot, () => true);
    expect(mocks.operations.find((entry) => entry.method === "remove_liquidity")?.args)
      .toEqual([{ address: "GUSER" }, { value: 1_000n }]);
  });

  it("does not submit when Freighter rejects signing", async () => {
    mocks.signResult = { error: { message: "User rejected the request" } };
    await expect(submitLiquidityAction("GUSER", { kind: "add", amountA: 10_000n, amountB: 20_000n }, snapshot, () => true))
      .rejects.toThrow("User rejected the request");
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
  });

  it("reports failed transaction status", async () => {
    mocks.transactionResult = "FAILED";
    await expect(submitLiquidityAction("GUSER", { kind: "remove", shares: 1_000n }, snapshot, () => true))
      .rejects.toThrow("contract-error-xdr");
  });

  it("rejects Freighter on the wrong network before reading or signing", async () => {
    mocks.network = "PUBLIC";
    await expect(submitLiquidityAction("GUSER", { kind: "add", amountA: 10_000n, amountB: 20_000n }, snapshot, () => true))
      .rejects.toThrow("Switch to Stellar testnet");
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });

  it("requires confirmation if the fresh preview changes by more than 0.5 percent", async () => {
    mocks.reserveA = 50_000n;
    mocks.reserveB = 100_000n;
    const confirm = vi.fn(() => false);
    await expect(submitLiquidityAction("GUSER", { kind: "add", amountA: 20_000n, amountB: 20_000n }, snapshot, confirm))
      .rejects.toThrow("preview changed");
    expect(confirm).toHaveBeenCalledWith(expect.any(Number));
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });

  it("times out while waiting for transaction confirmation", async () => {
    mocks.transactionResult = "NOT_FOUND";
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(121_000);
    await expect(submitLiquidityAction("GUSER", { kind: "remove", shares: 1_000n }, snapshot, () => true))
      .rejects.toThrow("Timed out waiting for transaction confirmation");
  });
});
