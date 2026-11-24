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

export type HealthLevel = "safe" | "warning" | "danger" | "liquidatable";

export type HealthThresholds = {
  warning: number;
  danger: number;
};

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  warning: 1.5,
  danger: 1.2,
};

/**
 * Classify a numeric health factor into a risk level using the standard
 * 1.5 / 1.2 / 1.0 boundaries (matching `lib/health.ts` / `HealthChip`).
 * Infinity or null (no debt) is classified as "safe".
 */
export function classifyHealth(
  health: number | null,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS
): HealthLevel {
  if (health === null || !Number.isFinite(health)) return "safe";
  if (health < 1.0) return "liquidatable";
  if (health < thresholds.danger) return "danger";
  if (health < thresholds.warning) return "warning";
  return "safe";
}

export type LiquidationMarketParams = MarketParams & {
  /** Optional liquidation threshold in basis points (e.g. 8000 = 80%). Falls back to `ltv * 10000`. */
  liqThresholdBps?: number;
};

const PRICE_SCALE = BigInt(100_000_000); // 1e8 fixed-point precision for USD prices
const BPS_SCALE = BigInt(10_000);

/**
 * Estimates the USD liquidation price for a single collateral asset `symbol`,
 * holding all other asset prices constant.
 *
 * Derivation from collateral factor / liquidation threshold in `market-params.ts`:
 * Let $S_i$ be supplied units, $B_i$ be borrowed units, $P_i$ be USD price, and
 * $t_i \in [0, 1]$ be the liquidation threshold (`liqThresholdBps / 10000`, or `ltv`
 * when no separate threshold is set).
 *
 * Liquidation occurs when health factor reaches 1.0:
 *   $$\sum_{j \neq k} S_j P_j t_j + S_k P_k^* t_k = \sum_{j \neq k} B_j P_j + B_k P_k^*$$
 *
 * Solving for $P_k^*$:
 *   $$P_k^* = \frac{\sum_{j \neq k} B_j P_j - \sum_{j \neq k} S_j P_j t_j}{S_k t_k - B_k}$$
 *
 * - Returns `null` when total portfolio debt is zero (no debt).
 * - Returns `null` when the target asset has no collateral ($S_k = 0$), zero threshold,
 *   or when $S_k t_k - B_k \le 0$ (asset is net-borrowed rather than net-collateral).
 * - Returns `0` when other collateral alone already covers all debt.
 * - Uses BigInt arithmetic for all balance/threshold/price products to avoid
 *   precision loss or `Number` overflow on large base-unit balances.
 */
export function liquidationPrice(
  ledger: Ledger,
  markets: LiquidationMarketParams[],
  symbol: string
): number | null {
  const targetMarket = markets.find((m) => m.symbol === symbol);
  if (!targetMarket) return null;

  const targetPos = ledger[symbol];
  if (!targetPos || targetPos.supplied <= BigInt(0)) return null;

  // Check if portfolio has any debt at all (BigInt-exact).
  let hasAnyDebt = false;
  let maxDecimals = targetMarket.decimals ?? DECIMALS;
  for (const m of markets) {
    const dec = m.decimals ?? DECIMALS;
    if (dec > maxDecimals) maxDecimals = dec;
    const pos = ledger[m.symbol];
    if (pos && pos.borrowed > BigInt(0) && m.price > 0) {
      hasAnyDebt = true;
    }
  }
  if (!hasAnyDebt) return null;

  const pow10 = (exp: number): bigint => BigInt(10) ** BigInt(exp);

  let otherLimitScaled = BigInt(0);
  let otherDebtScaled = BigInt(0);

  for (const m of markets) {
    if (m.symbol === symbol) continue;
    const pos = ledger[m.symbol];
    if (!pos) continue;
    const dec = m.decimals ?? DECIMALS;
    const scaleFactor = pow10(maxDecimals - dec);
    const suppliedNorm = pos.supplied * scaleFactor;
    const borrowedNorm = pos.borrowed * scaleFactor;
    const priceScaled = BigInt(Math.max(0, Math.round(m.price * 1e8)));
    const thresholdBps = BigInt(
      Math.max(0, Math.round(m.liqThresholdBps ?? m.ltv * 10_000))
    );

    otherLimitScaled += suppliedNorm * priceScaled * thresholdBps;
    otherDebtScaled += borrowedNorm * priceScaled * BPS_SCALE;
  }

  const targetDec = targetMarket.decimals ?? DECIMALS;
  const targetScale = pow10(maxDecimals - targetDec);
  const targetSuppliedNorm = targetPos.supplied * targetScale;
  const targetBorrowedNorm = targetPos.borrowed * targetScale;
  const targetThresholdBps = BigInt(
    Math.max(0, Math.round(targetMarket.liqThresholdBps ?? targetMarket.ltv * 10_000))
  );

  if (targetThresholdBps <= BigInt(0)) return null;

  const denom = targetSuppliedNorm * targetThresholdBps - targetBorrowedNorm * BPS_SCALE;
  if (denom <= BigInt(0)) return null;

  const netDebtScaled = otherDebtScaled - otherLimitScaled;
  if (netDebtScaled <= BigInt(0)) return 0;

  // netDebtScaled has scale (10^maxDecimals * PRICE_SCALE * BPS_SCALE).
  // denom has scale (10^maxDecimals * BPS_SCALE).
  // Quotient has scale PRICE_SCALE (1e8).
  const liqPriceScaled = netDebtScaled / denom;
  return Number(liqPriceScaled) / Number(PRICE_SCALE);
}
