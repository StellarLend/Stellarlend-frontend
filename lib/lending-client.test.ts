import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  operations: [] as Array<{ method: string; args: unknown[] }>,
  network: "TESTNET" as string,
  networkPassphrase: "testnet-passphrase" as string,
  simulationError: "" as string,
  position: { collateral: 50_000_000n, debt: 20_000_000n, health_factor: 20_000n } as Record<string, unknown>,
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
        if (mocks.simulationError) return { error: mocks.simulationError };
        if (tx.operation.method === "get_position") return { result: { retval: { value: mocks.position } } };
        return { result: { retval: { value: 0n } } };
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
      isSimulationError: (response: { error?: string }) => Boolean(response.error),
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
    networkPassphrase: mocks.networkPassphrase,
  })),
  signTransaction: (...args: unknown[]) => mocks.signTransaction(...args),
}));

vi.mock("@/lib/config", () => ({
  config: {
    network: "testnet",
    rpc: "https://soroban-testnet.stellar.org",
    lendingId: "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6",
  },
}));

import {
  HEALTH_FACTOR_NO_DEBT,
  normaliseHealthFactor,
  readMinBorrow,
  readPosition,
  submitLendingAction,
} from "./lending-client";

describe("lending client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.operations.length = 0;
    mocks.network = "TESTNET";
    mocks.networkPassphrase = "testnet-passphrase";
    mocks.simulationError = "";
    mocks.position = { collateral: 50_000_000n, debt: 20_000_000n, health_factor: 20_000n };
    mocks.signResult = { signedTxXdr: "signed-xdr" };
    mocks.signTransaction.mockReset().mockImplementation(async () => mocks.signResult);
    mocks.sendTransaction.mockReset().mockResolvedValue({ hash: "test-hash", status: "PENDING" });
    mocks.transactionResult = "SUCCESS";
  });

  it("decodes a position into exact base-unit bigints", async () => {
    const position = await readPosition("GUSER");
    expect(position).toEqual({ collateral: 50_000_000n, debt: 20_000_000n, healthFactor: 20_000n });
  });

  it("decodes the no-debt sentinel into null health", () => {
    expect(normaliseHealthFactor(HEALTH_FACTOR_NO_DEBT)).toBeNull();
    expect(normaliseHealthFactor(20_000n)).toBe(2);
  });

  it("reads the protocol minimum borrow as a bigint", async () => {
    await expect(readMinBorrow("GUSER")).resolves.toBe(0n);
    expect(mocks.operations.at(-1)?.method).toBe("get_min_borrow");
  });

  it("deposits with the caller and exact i128 amount, then signs, submits and confirms", async () => {
    const updates: string[] = [];
    const result = await submitLendingAction("GUSER", "deposit", 10_000_000n, (tx) => updates.push(tx.status));

    const operation = mocks.operations.find((entry) => entry.method === "deposit");
    expect(operation?.args).toEqual([{ address: "GUSER" }, { value: 10_000_000n }]);
    expect(mocks.signTransaction).toHaveBeenCalledWith("transaction-xdr", { networkPassphrase: "testnet-passphrase" });
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "confirmed", hash: "test-hash", error: null });
    expect(updates).toContain("pending");
  });

  it("does not submit when Freighter rejects signing", async () => {
    mocks.signResult = { error: { message: "User rejected the request" } };
    const result = await submitLendingAction("GUSER", "borrow", 10_000_000n);
    expect(result.status).toBe("cancelled");
    expect(result.error?.name).toBe("UserRejected");
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects the wrong network before reading or signing", async () => {
    mocks.network = "PUBLIC";
    mocks.networkPassphrase = "public-passphrase";
    const result = await submitLendingAction("GUSER", "deposit", 10_000_000n);
    expect(result.status).toBe("failed");
    expect(mocks.signTransaction).not.toHaveBeenCalled();
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
  });

  it("surfaces a simulated contract error with the decoded code", async () => {
    mocks.simulationError = "simulation failed: Error(Contract, #2007)";
    const result = await submitLendingAction("GUSER", "borrow", 10_000_000n);
    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({ code: 2007, name: "InsufficientCollateral" });
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });

  it("reports failed transaction status with the decoded contract error", async () => {
    mocks.transactionResult = "FAILED";
    const result = await submitLendingAction("GUSER", "repay", 1_000n);
    expect(result.status).toBe("failed");
    expect(result.hash).toBe("test-hash");
  });

  it("rejects non-positive amounts without contacting the wallet", async () => {
    const result = await submitLendingAction("GUSER", "deposit", 0n);
    expect(result.status).toBe("failed");
    expect(result.error?.name).toBe("InvalidAmount");
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });

  it("times out without retrying an uncertain submission", async () => {
    mocks.transactionResult = "NOT_FOUND";
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(121_000);
    const result = await submitLendingAction("GUSER", "withdraw", 1_000n);
    expect(result.status).toBe("timeout");
    expect(result.hash).toBe("test-hash");
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(1);
  });
});
