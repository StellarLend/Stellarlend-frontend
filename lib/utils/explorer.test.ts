import { describe, expect, it } from "vitest";
import {
  buildStellarExpertTransactionUrl,
  getTransactionHash,
} from "./explorer";
import type { Transaction } from "@/types/Transaction";

const hash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd";

const transaction: Transaction = {
  id: "TXN-001",
  type: "Deposit",
  amount: 100,
  asset: "XLM",
  date: "2024-01-15",
  time: "10:30AM",
  status: "Completed",
};

describe("Stellar Expert transaction links", () => {
  it("prefers txHash over hash and id", () => {
    expect(
      getTransactionHash({
        ...transaction,
        txHash: hash.toUpperCase(),
        hash: "b".repeat(64),
        id: "c".repeat(64),
      }),
    ).toBe(hash);
  });

  it("falls back to hash and then a hash-shaped id", () => {
    expect(getTransactionHash({ ...transaction, hash })).toBe(hash);
    expect(getTransactionHash({ ...transaction, id: hash })).toBe(hash);
  });

  it("does not treat mock ids as explorer hashes", () => {
    expect(getTransactionHash(transaction)).toBeNull();
    expect(getTransactionHash({ ...transaction, id: "txn-001" })).toBeNull();
  });

  it("builds network-specific Stellar Expert URLs", () => {
    expect(buildStellarExpertTransactionUrl(hash, "PUBLIC")).toBe(
      `https://stellar.expert/explorer/public/tx/${hash}`,
    );
    expect(buildStellarExpertTransactionUrl(hash, "TESTNET")).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
  });
});
