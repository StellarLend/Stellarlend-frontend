export interface LendingData {
  asset: string;
  amount: number;
  interestRate: number;
  duration?: number;
  collateral?: string;
  collateralAmount?: number;
}

export interface CalculationResult {
  totalEarnings: number;
  dailyEarnings: number;
  totalRepayment?: number;
  monthlyPayment?: number;
}
