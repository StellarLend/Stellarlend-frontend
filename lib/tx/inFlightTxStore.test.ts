import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  addInFlightTx,
  removeInFlightTx,
  getInFlightTxs,
  subscribeInFlightTxs,
  clearInFlightTxs,
  type InFlightTransaction,
} from "./inFlightTxStore";

describe("inFlightTxStore", () => {
  beforeEach(() => {
    clearInFlightTxs();
  });

  it("should add and retrieve in-flight transactions", () => {
    const tx = addInFlightTx({
      hash: "0x123",
      type: "Supply" as any,
      amount: 100,
      asset: "XLM" as any,
    });

    expect(tx.hash).toBe("0x123");
    expect(tx.timestamp).toBeDefined();
    expect(getInFlightTxs()).toHaveLength(1);
    expect(getInFlightTxs()[0].hash).toBe("0x123");
  });

  it("should update existing transaction if hash matches", () => {
    addInFlightTx({
      hash: "0x123",
      type: "Supply" as any,
      amount: 100,
      asset: "XLM" as any,
    });

    addInFlightTx({
      hash: "0x123",
      type: "Supply" as any,
      amount: 200,
      asset: "XLM" as any,
    });

    expect(getInFlightTxs()).toHaveLength(1);
    expect(getInFlightTxs()[0].amount).toBe(200);
  });

  it("should remove in-flight transaction by hash", () => {
    addInFlightTx({
      hash: "0x123",
      type: "Supply" as any,
      amount: 100,
      asset: "XLM" as any,
    });

    removeInFlightTx("0x123");
    expect(getInFlightTxs()).toHaveLength(0);
  });

  it("should notify subscribers on change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInFlightTxs(listener);

    addInFlightTx({
      hash: "0x456",
      type: "Borrow" as any,
      amount: 50,
      asset: "USDC" as any,
    });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    addInFlightTx({
      hash: "0x789",
      type: "Repay" as any,
      amount: 25,
      asset: "USDC" as any,
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should clear all in-flight transactions", () => {
    addInFlightTx({
      hash: "0x111",
      type: "Supply" as any,
      amount: 10,
      asset: "XLM" as any,
    });

    clearInFlightTxs();
    expect(getInFlightTxs()).toHaveLength(0);
  });
});
