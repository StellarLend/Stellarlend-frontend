import { describe, it, expect } from "vitest";
import { projectPosition, maxAmount, floorToDecimals } from "./projection";
import { parseAmount } from "./demo-ledger";
import type { Ledger, MarketParams } from "./demo-ledger";

function parseSafe(val: string, decimals: number): bigint {
  const res = parseAmount(val, decimals);
  if (!res.ok) throw new Error(`Failed to parse ${val}`);
  return res.value;
}

const MARKETS: MarketParams[] = [
  { symbol: "XLM", price: 0.12, ltv: 0.7, decimals: 7 },
  { symbol: "USDC", price: 1.0, ltv: 0.85, decimals: 7 },
  { symbol: "BTC", price: 60000, ltv: 0.75, decimals: 8 },
];

describe("floorToDecimals", () => {
  it("floors down without rounding up", () => {
    expect(floorToDecimals(1.2399999, 2)).toBe("1.23");
    expect(floorToDecimals(0.00000019, 7)).toBe("0.0000001");
    expect(floorToDecimals(100, 2)).toBe("100");
    expect(floorToDecimals(-5, 2)).toBe("0");
    expect(floorToDecimals(NaN, 2)).toBe("0");
  });
});

describe("projectPosition", () => {
  it("projects supply correctly", () => {
    const ledger: Ledger = {};
    const proj = projectPosition(ledger, MARKETS, MARKETS[0], "supply", "1000"); // 1000 XLM @ $0.12 = $120
    expect(proj).not.toBeNull();
    expect(proj?.collateralUsd).toBeCloseTo(120);
    expect(proj?.limitUsd).toBeCloseTo(120 * 0.7); // $84
    expect(proj?.borrowUsd).toBe(0);
    expect(proj?.health).toBe(Infinity);
    expect(proj?.borrowLimitUsedPercent).toBe(0);
    expect(proj?.isUnsafe).toBe(false);
    expect(proj?.isWarning).toBe(false);
  });

  it("projects borrow and updates health factor and limit used", () => {
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("1000", 7), borrowed: BigInt(0) },
    };
    // Borrow 50 USDC ($50) against $84 limit
    const proj = projectPosition(ledger, MARKETS, MARKETS[1], "borrow", "50");
    expect(proj).not.toBeNull();
    expect(proj?.borrowUsd).toBeCloseTo(50);
    expect(proj?.limitUsd).toBeCloseTo(84);
    // health = 84 / 50 = 1.68
    expect(proj?.health).toBeCloseTo(1.68);
    expect(proj?.borrowLimitUsedPercent).toBeCloseTo((50 / 84) * 100);
    expect(proj?.isUnsafe).toBe(false);
    expect(proj?.isWarning).toBe(false);
  });

  it("identifies warning health factor (< 1.2)", () => {
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("1000", 7), borrowed: BigInt(0) }, // $84 limit
    };
    // Borrow 75 USDC -> 84 / 75 = 1.12 (< 1.2)
    const proj = projectPosition(ledger, MARKETS, MARKETS[1], "borrow", "75");
    expect(proj?.isWarning).toBe(true);
    expect(proj?.isUnsafe).toBe(false);
  });

  it("identifies unsafe health factor (< 1.0)", () => {
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("1000", 7), borrowed: BigInt(0) }, // $84 limit
    };
    // Borrow 90 USDC -> 84 / 90 = 0.933 (< 1.0)
    const proj = projectPosition(ledger, MARKETS, MARKETS[1], "borrow", "90");
    expect(proj?.isWarning).toBe(true);
    expect(proj?.isUnsafe).toBe(true);
  });

  it("projects withdraw correctly", () => {
    const ledger: Ledger = {
      USDC: { supplied: parseSafe("100", 7), borrowed: parseSafe("50", 7) },
    };
    // Limit was $85, withdraw 20 USDC -> next collateral $80, next limit $68, borrow $50 -> HF = 68/50 = 1.36
    const proj = projectPosition(ledger, MARKETS, MARKETS[1], "withdraw", "20");
    expect(proj?.collateralUsd).toBeCloseTo(80);
    expect(proj?.limitUsd).toBeCloseTo(68);
    expect(proj?.borrowUsd).toBeCloseTo(50);
    expect(proj?.health).toBeCloseTo(1.36);
  });

  it("projects repay correctly", () => {
    const ledger: Ledger = {
      USDC: { supplied: parseSafe("100", 7), borrowed: parseSafe("50", 7) },
    };
    const proj = projectPosition(ledger, MARKETS, MARKETS[1], "repay", "50");
    expect(proj?.borrowUsd).toBe(0);
    expect(proj?.health).toBe(Infinity);
    expect(proj?.borrowLimitUsedPercent).toBe(0);
  });

  it("returns null for invalid / non-positive input", () => {
    const ledger: Ledger = {};
    expect(projectPosition(ledger, MARKETS, MARKETS[0], "supply", "")).toBeNull();
    expect(projectPosition(ledger, MARKETS, MARKETS[0], "supply", "abc")).toBeNull();
    expect(projectPosition(ledger, MARKETS, MARKETS[0], "supply", "-10")).toBeNull();
    expect(projectPosition(ledger, MARKETS, MARKETS[0], "supply", "0")).toBeNull();
    expect(projectPosition(ledger, MARKETS, MARKETS[0], "supply", NaN)).toBeNull();
    expect(projectPosition(ledger, MARKETS, MARKETS[0], "supply", Infinity)).toBeNull();
  });
});

describe("maxAmount", () => {
  it("handles supply with unknown wallet balance (null)", () => {
    const ledger: Ledger = {};
    const max = maxAmount({
      mode: "supply",
      symbol: "XLM",
      ledger,
      markets: MARKETS,
      walletBalance: null,
    });
    expect(max).toBeNull();
  });

  it("handles supply with XLM reserve subtraction", () => {
    const ledger: Ledger = {};
    // Wallet has 10 XLM, reserve is 2 XLM -> 8 XLM available
    const max = maxAmount({
      mode: "supply",
      symbol: "XLM",
      ledger,
      markets: MARKETS,
      walletBalance: "10.00",
      xlmReserve: 2.0,
    });
    expect(max).toBe("8");
  });

  it("handles supply when balance is below XLM reserve (never negative)", () => {
    const ledger: Ledger = {};
    const max = maxAmount({
      mode: "supply",
      symbol: "XLM",
      ledger,
      markets: MARKETS,
      walletBalance: "1.50",
      xlmReserve: 2.0,
    });
    expect(max).toBe("0");
  });

  it("handles borrow with safety factor and boundary conditions", () => {
    // 1000 XLM @ $0.12, LTV 0.7 = $84 limit
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("1000", 7), borrowed: BigInt(0) },
    };
    // Borrow USDC @ $1.0, safetyFactor = 0.95 -> 84 * 0.95 = $79.8 USDC
    const max = maxAmount({
      mode: "borrow",
      symbol: "USDC",
      ledger,
      markets: MARKETS,
      safetyFactor: 0.95,
    });
    expect(max).toBe("79.8");
  });

  it("handles borrow at zero collateral", () => {
    const ledger: Ledger = {};
    const max = maxAmount({
      mode: "borrow",
      symbol: "USDC",
      ledger,
      markets: MARKETS,
    });
    expect(max).toBe("0");
  });

  it("handles borrow exactly at limit", () => {
    // 1000 XLM supplied ($84 limit), 84 USDC borrowed
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("1000", 7), borrowed: BigInt(0) },
      USDC: { supplied: BigInt(0), borrowed: parseSafe("84", 7) },
    };
    const max = maxAmount({
      mode: "borrow",
      symbol: "USDC",
      ledger,
      markets: MARKETS,
    });
    expect(max).toBe("0");
  });

  it("handles withdraw with zero debt (entire supply withdrawable)", () => {
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("500", 7), borrowed: BigInt(0) },
    };
    const max = maxAmount({
      mode: "withdraw",
      symbol: "XLM",
      ledger,
      markets: MARKETS,
    });
    expect(max).toBe("500");
  });

  it("handles withdraw keeping HF >= 1.0 when debt exists", () => {
    // Supply 100 USDC ($85 limit @ 0.85 LTV). Borrow 50 USDC ($50 debt).
    // Excess limit = 85 - 50 = $35.
    // Max USDC that can be withdrawn: 35 / (1.0 * 0.85) = 41.1764705 USDC.
    const ledger: Ledger = {
      USDC: { supplied: parseSafe("100", 7), borrowed: parseSafe("50", 7) },
    };
    const max = maxAmount({
      mode: "withdraw",
      symbol: "USDC",
      ledger,
      markets: MARKETS,
    });
    expect(parseFloat(max!)).toBeCloseTo(41.1764705, 4);
    // Ensure after withdrawing this max amount, HF is >= 1.0
    const proj = projectPosition(ledger, MARKETS, MARKETS[1], "withdraw", max!);
    expect(proj!.health).toBeGreaterThanOrEqual(1.0);
  });

  it("handles repay with balance and debt", () => {
    const ledger: Ledger = {
      USDC: { supplied: BigInt(0), borrowed: parseSafe("100", 7) },
    };
    // Balance is 60 USDC -> max repay is 60
    const maxWithBal = maxAmount({
      mode: "repay",
      symbol: "USDC",
      ledger,
      markets: MARKETS,
      walletBalance: "60",
    });
    expect(maxWithBal).toBe("60");

    // Balance is 200 USDC -> max repay is debt (100)
    const maxOverBal = maxAmount({
      mode: "repay",
      symbol: "USDC",
      ledger,
      markets: MARKETS,
      walletBalance: "200",
    });
    expect(maxOverBal).toBe("100");
  });
});
