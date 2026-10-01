import { describe, it, expect } from "vitest";
import { getTransactionComparator, sortTransactions } from "./sort";
import type { Transaction, TransactionType, TransactionStatus, AssetSymbol } from "@/types/Transaction";

const createTx = (overrides: Partial<Transaction>): Transaction => ({
  id: "default-id",
  type: "deposit" as TransactionType,
  amount: 100,
  asset: "USDC" as AssetSymbol,
  date: "2023-10-01",
  time: "12:00:00",
  status: "completed" as TransactionStatus,
  ...overrides,
});

describe("Transaction sorting", () => {
  describe("compareByDateTime (default fallback)", () => {
    it("sorts by date and time correctly", () => {
      const tx1 = createTx({ id: "1", date: "2023-10-01", time: "10:00:00" });
      const tx2 = createTx({ id: "2", date: "2023-10-02", time: "10:00:00" });
      const tx3 = createTx({ id: "3", date: "2023-10-01", time: "11:00:00" });

      const sorted = sortTransactions([tx2, tx3, tx1], "date", "asc");
      expect(sorted.map(t => t.id)).toEqual(["1", "3", "2"]);
    });

    it("sorts by date and time correctly descending", () => {
      const tx1 = createTx({ id: "1", date: "2023-10-01", time: "10:00:00" });
      const tx2 = createTx({ id: "2", date: "2023-10-02", time: "10:00:00" });
      const tx3 = createTx({ id: "3", date: "2023-10-01", time: "11:00:00" });

      const sorted = sortTransactions([tx2, tx3, tx1], "date", "desc");
      expect(sorted.map(t => t.id)).toEqual(["2", "3", "1"]);
    });
  });

  describe("Amount sorting", () => {
    it("sorts by amount ascending", () => {
      const tx1 = createTx({ id: "1", amount: 50 });
      const tx2 = createTx({ id: "2", amount: 150 });
      const tx3 = createTx({ id: "3", amount: 100 });

      const sorted = sortTransactions([tx2, tx3, tx1], "amount", "asc");
      expect(sorted.map(t => t.amount)).toEqual([50, 100, 150]);
    });

    it("sorts by amount descending", () => {
      const tx1 = createTx({ id: "1", amount: 50 });
      const tx2 = createTx({ id: "2", amount: 150 });
      const tx3 = createTx({ id: "3", amount: 100 });

      const sorted = sortTransactions([tx2, tx3, tx1], "amount", "desc");
      expect(sorted.map(t => t.amount)).toEqual([150, 100, 50]);
    });
  });

  describe("Status sorting", () => {
    it("sorts by status ascending", () => {
      const tx1 = createTx({ id: "1", status: "completed" as TransactionStatus });
      const tx2 = createTx({ id: "2", status: "pending" as TransactionStatus });
      const tx3 = createTx({ id: "3", status: "failed" as TransactionStatus });

      const sorted = sortTransactions([tx2, tx3, tx1], "status", "asc");
      expect(sorted.map(t => t.status)).toEqual(["completed", "failed", "pending"]);
    });

    it("sorts by status descending", () => {
      const tx1 = createTx({ id: "1", status: "completed" as TransactionStatus });
      const tx2 = createTx({ id: "2", status: "pending" as TransactionStatus });
      const tx3 = createTx({ id: "3", status: "failed" as TransactionStatus });

      const sorted = sortTransactions([tx2, tx3, tx1], "status", "desc");
      expect(sorted.map(t => t.status)).toEqual(["pending", "failed", "completed"]);
    });
  });

  describe("Tie-breaking logic", () => {
    it("breaks amount ties with date/time", () => {
      const tx1 = createTx({ id: "1", amount: 100, date: "2023-10-01", time: "10:00:00" });
      const tx2 = createTx({ id: "2", amount: 100, date: "2023-10-02", time: "10:00:00" });
      
      const sortedAsc = sortTransactions([tx2, tx1], "amount", "asc");
      expect(sortedAsc.map(t => t.id)).toEqual(["1", "2"]);

      const sortedDesc = sortTransactions([tx1, tx2], "amount", "desc");
      expect(sortedDesc.map(t => t.id)).toEqual(["2", "1"]);
    });

    it("breaks date/time ties with ID", () => {
      const tx1 = createTx({ id: "A", date: "2023-10-01", time: "10:00:00" });
      const tx2 = createTx({ id: "B", date: "2023-10-01", time: "10:00:00" });

      const sortedAsc = sortTransactions([tx2, tx1], "date", "asc");
      expect(sortedAsc.map(t => t.id)).toEqual(["A", "B"]);

      const sortedDesc = sortTransactions([tx1, tx2], "date", "desc");
      expect(sortedDesc.map(t => t.id)).toEqual(["B", "A"]);
    });

    it("breaks status ties with date/time, then ID", () => {
      const tx1 = createTx({ id: "B", status: "completed" as TransactionStatus, date: "2023-10-01", time: "10:00:00" });
      const tx2 = createTx({ id: "A", status: "completed" as TransactionStatus, date: "2023-10-01", time: "10:00:00" });
      const tx3 = createTx({ id: "C", status: "completed" as TransactionStatus, date: "2023-10-02", time: "10:00:00" });

      const sortedAsc = sortTransactions([tx3, tx1, tx2], "status", "asc");
      expect(sortedAsc.map(t => t.id)).toEqual(["A", "B", "C"]);

      const sortedDesc = sortTransactions([tx3, tx1, tx2], "status", "desc");
      expect(sortedDesc.map(t => t.id)).toEqual(["C", "B", "A"]);
    });
    
    it("handles invalid dates by falling back to string comparison", () => {
      const tx1 = createTx({ id: "1", date: "Invalid Date", time: "10:00:00" });
      const tx2 = createTx({ id: "2", date: "Invalid Date", time: "11:00:00" });
      const tx3 = createTx({ id: "3", date: "Valid Not", time: "10:00:00" });
      
      const sortedAsc = sortTransactions([tx2, tx3, tx1], "date", "asc");
      expect(sortedAsc.map(t => t.id)).toEqual(["1", "2", "3"]);
    });
  });
});
