import TransactionSummary from '../../components/features/lending/components/TransactionSummary';
import type { LendingData, CalculationResult } from '@/app/lending/page';

export default {
  title: 'Features/Lending/TransactionSummary',
  component: TransactionSummary,
};

const mockData: LendingData = {
  amount: 1000,
  asset: 'USDC',
  interestRate: 5,
  duration: 30,
  collateral: 'ETH',
  collateralAmount: 0.5,
};

const mockCalculation: CalculationResult = {
  dailyEarnings: 0.5,
  totalEarnings: 50,
  totalRepayment: 1050,
  monthlyPayment: 350,
};

export const Lend = {
  args: {
    data: mockData,
    calculation: mockCalculation,
    type: 'lend' as const,
  },
};

export const Borrow = {
  args: {
    data: mockData,
    calculation: mockCalculation,
    type: 'borrow' as const,
  },
};
