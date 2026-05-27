import { describe, it, expect } from "vitest";
import {
  ASSET_SYMBOLS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  isAssetSymbol,
  isTransactionType,
  isTransactionStatus,
} from "@/types/enums";

// ---------------------------------------------------------------------------
// Enum membership
// ---------------------------------------------------------------------------

describe("ASSET_SYMBOLS", () => {
  it("contains exactly XLM, USDC, BTC, ETH", () => {
    expect([...ASSET_SYMBOLS]).toEqual(["XLM", "USDC", "BTC", "ETH"]);
  });
});

describe("TRANSACTION_TYPES", () => {
  it("contains exactly the four canonical types", () => {
    expect([...TRANSACTION_TYPES]).toEqual([
      "Deposit",
      "Withdrawal",
      "Lend Funds",
      "Loan Payment",
    ]);
  });
});

describe("TRANSACTION_STATUSES", () => {
  it("contains exactly Completed, Processing, Failed", () => {
    expect([...TRANSACTION_STATUSES]).toEqual([
      "Completed",
      "Processing",
      "Failed",
    ]);
  });
});

// ---------------------------------------------------------------------------
// isAssetSymbol
// ---------------------------------------------------------------------------

describe("isAssetSymbol", () => {
  it.each([...ASSET_SYMBOLS])("accepts valid symbol %s", (sym) => {
    expect(isAssetSymbol(sym)).toBe(true);
  });

  it.each(["STRK", "strk", "xlm", "usdc", "", "DOGE", null, undefined, 42])(
    "rejects invalid value %s",
    (val) => {
      expect(isAssetSymbol(val)).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// isTransactionType
// ---------------------------------------------------------------------------

describe("isTransactionType", () => {
  it.each([...TRANSACTION_TYPES])("accepts valid type %s", (t) => {
    expect(isTransactionType(t)).toBe(true);
  });

  it.each(["deposit", "DEPOSIT", "Transfer", "", null, undefined])(
    "rejects invalid value %s",
    (val) => {
      expect(isTransactionType(val)).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// isTransactionStatus
// ---------------------------------------------------------------------------

describe("isTransactionStatus", () => {
  it.each([...TRANSACTION_STATUSES])("accepts valid status %s", (s) => {
    expect(isTransactionStatus(s)).toBe(true);
  });

  it.each(["completed", "COMPLETED", "Pending", "", null, undefined])(
    "rejects invalid value %s",
    (val) => {
      expect(isTransactionStatus(val)).toBe(false);
    }
  );
});
