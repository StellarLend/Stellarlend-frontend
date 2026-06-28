import { getMarket } from "@/lib/registry";

export type ActionType = "lend" | "borrow" | "repay";

export interface FeeResult {
  feeAmount: number;
  feeBps: number;
  marketId: string;
  action: ActionType;
}

/**
 * Calculates the protocol fee applied to an action on a specific market.
 */
export function calculateProtocolFee(
  marketId: string,
  action: ActionType,
  amount: number,
): FeeResult {
  if (amount < 0) {
    throw new Error("Amount cannot be negative");
  }

  const market = getMarket(marketId);
  if (!market) {
    throw new Error(`Market not found: ${marketId}`);
  }

  const schedule = market.feeSchedule;
  const bps =
    action === "lend"
      ? schedule.lendFeeBps
      : action === "borrow"
        ? schedule.borrowFeeBps
        : schedule.repayFeeBps;

  const calculatedFee = (amount * bps) / 10000;
  const feeAmount = Math.max(calculatedFee, schedule.minFeeAmount);

  return {
    feeAmount: amount === 0 ? 0 : feeAmount,
    feeBps: bps,
    marketId,
    action,
  };
}
