import {
  DECIMALS,
  computeRisk,
  toFloat,
  type Ledger,
  type MarketParams,
} from "./demo-ledger";

export type TradeMode = "supply" | "borrow" | "withdraw" | "repay";

export interface ProjectedPosition {
  collateralUsd: number;
  borrowUsd: number;
  limitUsd: number;
  health: number;
  borrowLimitUsedPercent: number;
  isUnsafe: boolean; // projected health < 1.0
  isWarning: boolean; // projected health < 1.2
}

export interface MaxAmountOptions {
  mode: TradeMode;
  symbol: string;
  ledger: Ledger;
  markets: MarketParams[];
  walletBalance?: string | number | null; // e.g. XLM balance
  xlmReserve?: number; // default 2.0 XLM
  safetyFactor?: number; // default 0.95 for borrow
}

/**
 * Floor a number to a fixed number of decimal places without scientific notation or floating drift.
 * Never rounds up.
 */
export function floorToDecimals(val: number, decimals: number): string {
  if (!isFinite(val) || val <= 0) return "0";
  const rawStr = val.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
  const [whole, frac = ""] = rawStr.split(".");
  if (decimals <= 0 || frac.length === 0) return whole;
  const truncatedFrac = frac.slice(0, decimals).replace(/0+$/, "");
  if (truncatedFrac.length === 0) return whole;
  return `${whole}.${truncatedFrac}`;
}

/**
 * Calculates the maximum safe trade amount for a given mode and market.
 * Returns null if the balance is unknown (e.g. supply with unknown wallet balance).
 * Returns the amount as a decimal string rounded DOWN to the market decimals.
 */
export function maxAmount(options: MaxAmountOptions): string | null {
  const {
    mode,
    symbol,
    ledger,
    markets,
    walletBalance,
    xlmReserve = 2.0,
    safetyFactor = 0.95,
  } = options;

  const market = markets.find((m) => m.symbol === symbol);
  if (!market) return "0";
  const decimals = market.decimals ?? DECIMALS;
  const currentPos = ledger[symbol] ?? { supplied: BigInt(0), borrowed: BigInt(0) };

  if (mode === "supply") {
    // If wallet balance is null / undefined:
    if (walletBalance === null || walletBalance === undefined) {
      return null;
    }
    const balNum = typeof walletBalance === "string" ? parseFloat(walletBalance) : walletBalance;
    if (isNaN(balNum) || balNum <= 0) return "0";

    if (symbol === "XLM") {
      const available = balNum - xlmReserve;
      return available > 0 ? floorToDecimals(available, decimals) : "0";
    }
    return floorToDecimals(balNum, decimals);
  }

  if (mode === "repay") {
    const borrowedFloat = toFloat(currentPos.borrowed, decimals);
    if (borrowedFloat <= 0) return "0";

    if (walletBalance !== null && walletBalance !== undefined) {
      const balNum = typeof walletBalance === "string" ? parseFloat(walletBalance) : walletBalance;
      if (!isNaN(balNum)) {
        let availableBalance = balNum;
        if (symbol === "XLM") {
          availableBalance = Math.max(0, balNum - xlmReserve);
        }
        const repayAmt = Math.min(borrowedFloat, availableBalance);
        return repayAmt > 0 ? floorToDecimals(repayAmt, decimals) : "0";
      }
    }
    return floorToDecimals(borrowedFloat, decimals);
  }

  if (mode === "borrow") {
    // borrow limit = remaining limit * safetyFactor / price
    const { limitUsd, borrowUsd } = computeRisk(ledger, markets);
    const remainingLimitUsd = limitUsd - borrowUsd;
    if (remainingLimitUsd <= 0 || market.price <= 0) return "0";

    const safeRemainingUsd = remainingLimitUsd * safetyFactor;
    const maxTokens = safeRemainingUsd / market.price;
    return maxTokens > 0 ? floorToDecimals(maxTokens, decimals) : "0";
  }

  if (mode === "withdraw") {
    // withdraw -> largest amount keeping HF >= 1.0 (limitUsd_after >= borrowUsd)
    const suppliedFloat = toFloat(currentPos.supplied, decimals);
    if (suppliedFloat <= 0) return "0";

    const { limitUsd, borrowUsd } = computeRisk(ledger, markets);
    if (borrowUsd <= 0) {
      // No debt anywhere, can withdraw entire supplied position
      return floorToDecimals(suppliedFloat, decimals);
    }

    if (limitUsd <= borrowUsd) {
      // Already at or below limit
      return "0";
    }

    if (market.ltv <= 0 || market.price <= 0) {
      // Assets with 0 LTV don't contribute to borrow limit, so withdrawing does not reduce limitUsd
      return floorToDecimals(suppliedFloat, decimals);
    }

    const excessLimitUsd = limitUsd - borrowUsd;
    const maxTokensByLimit = excessLimitUsd / (market.price * market.ltv);
    const withdrawable = Math.min(suppliedFloat, maxTokensByLimit);

    return withdrawable > 0 ? floorToDecimals(withdrawable, decimals) : "0";
  }

  return "0";
}

/**
 * Pure projection of position aggregates after a proposed trade.
 * Returns null if amount is invalid, not finite, or <= 0.
 */
export function projectPosition(
  currentLedger: Ledger,
  markets: MarketParams[],
  market: MarketParams,
  mode: TradeMode,
  amount: bigint | number | string
): ProjectedPosition | null {
  let deltaTokens: number;
  if (typeof amount === "bigint") {
    const decimals = market.decimals ?? DECIMALS;
    deltaTokens = toFloat(amount, decimals);
  } else if (typeof amount === "string") {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) return null;
    deltaTokens = parsed;
  } else {
    if (isNaN(amount) || !isFinite(amount) || amount <= 0) return null;
    deltaTokens = amount;
  }

  const currentPos = currentLedger[market.symbol] ?? { supplied: BigInt(0), borrowed: BigInt(0) };
  const decimals = market.decimals ?? DECIMALS;
  const currentSupplied = toFloat(currentPos.supplied, decimals);
  const currentBorrowed = toFloat(currentPos.borrowed, decimals);

  let nextSupplied = currentSupplied;
  let nextBorrowed = currentBorrowed;

  if (mode === "supply") {
    nextSupplied = currentSupplied + deltaTokens;
  } else if (mode === "withdraw") {
    nextSupplied = Math.max(0, currentSupplied - deltaTokens);
  } else if (mode === "borrow") {
    nextBorrowed = currentBorrowed + deltaTokens;
  } else if (mode === "repay") {
    nextBorrowed = Math.max(0, currentBorrowed - deltaTokens);
  }

  // Calculate projected totals
  let collateralUsd = 0;
  let limitUsd = 0;
  let borrowUsd = 0;

  for (const m of markets) {
    if (m.symbol === market.symbol) {
      collateralUsd += nextSupplied * m.price;
      limitUsd += nextSupplied * m.price * m.ltv;
      borrowUsd += nextBorrowed * m.price;
    } else {
      const pos = currentLedger[m.symbol];
      if (pos) {
        const dec = m.decimals ?? DECIMALS;
        const s = toFloat(pos.supplied, dec);
        const b = toFloat(pos.borrowed, dec);
        collateralUsd += s * m.price;
        limitUsd += s * m.price * m.ltv;
        borrowUsd += b * m.price;
      }
    }
  }

  const health = borrowUsd > 0 ? limitUsd / borrowUsd : Infinity;
  const borrowLimitUsedPercent =
    limitUsd > 0
      ? Math.min(100, Math.max(0, (borrowUsd / limitUsd) * 100))
      : borrowUsd > 0
      ? 100
      : 0;

  return {
    collateralUsd,
    borrowUsd,
    limitUsd,
    health,
    borrowLimitUsedPercent,
    isUnsafe: health < 1.0,
    isWarning: health < 1.2,
  };
}
