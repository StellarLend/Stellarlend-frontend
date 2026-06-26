export type LendingActionType = "lend" | "borrow" | "repay" | "withdraw";

export interface LendingData {
  asset: string;
  amount: number;
  interestRate: number;
  duration?: number;
  collateral?: string;
  collateralAmount?: number;
  positionId?: string;
  outstandingDebt?: number;
  remainingDebt?: number;
  healthFactorBefore?: number;
  healthFactorAfter?: number;
}

export interface CalculationResult {
  totalEarnings: number;
  dailyEarnings: number;
  totalRepayment?: number;
  monthlyPayment?: number;
}
