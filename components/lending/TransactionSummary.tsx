import { LendingData, CalculationResult } from '@/app/lending/page';

interface TransactionSummaryProps {
  data: LendingData;
  calculation: CalculationResult;
  type: 'lend' | 'borrow';
}

export default function TransactionSummary({ data, calculation, type }: TransactionSummaryProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4 
    })} ${currency}`;
  };

  const formatDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Transaction Summary
      </h3>

      <div className="space-y-4">
        {/* Header Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {type === 'lend' ? 'Lending' : 'Borrowing'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              type === 'lend' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {type === 'lend' ? 'LEND' : 'BORROW'}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(data.amount, data.asset)}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Asset</span>
            <span className="font-medium">{data.asset}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Interest Rate</span>
            <span className="font-medium">
              {data.interestRate.toFixed(1)}% {type === 'lend' ? 'APY' : 'APR'}
            </span>
          </div>

          {type === 'borrow' && data.duration && (
            <div className="flex justify-between">
              <span className="text-gray-600">Duration</span>
              <span className="font-medium">{data.duration} days</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-600">Start Date</span>
            <span className="font-medium">{formatDate(0)}</span>
          </div>

          {data.duration && (
            <div className="flex justify-between">
              <span className="text-gray-600">End Date</span>
              <span className="font-medium">{formatDate(data.duration)}</span>
            </div>
          )}
        </div>

        {/* Collateral Info for Borrowing */}
        {type === 'borrow' && data.collateral && data.collateralAmount && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Collateral</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Asset</span>
                <span className="font-medium">{data.collateral}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-medium">
                  {formatCurrency(data.collateralAmount, data.collateral)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ratio</span>
                <span className="font-medium text-green-600">150%</span>
              </div>
            </div>
          </div>
        )}

        {/* Financial Summary */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">
            {type === 'lend' ? 'Expected Returns' : 'Repayment Details'}
          </h4>
          
          {type === 'lend' ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Daily Earnings</span>
                <span className="font-medium text-green-600">
                  +{formatCurrency(calculation.dailyEarnings, data.asset)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Earnings</span>
                <span className="font-semibold text-green-600">
                  +{formatCurrency(calculation.totalEarnings, data.asset)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Total Return</span>
                <span className="font-semibold text-lg">
                  {formatCurrency(data.amount + calculation.totalEarnings, data.asset)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {calculation.monthlyPayment && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Payment</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(calculation.monthlyPayment, data.asset)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Total Interest</span>
                <span className="font-medium text-red-500">
                  {formatCurrency(calculation.totalEarnings, data.asset)}
                </span>
              </div>
              {calculation.totalRepayment && (
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Total Repayment</span>
                  <span className="font-semibold text-lg">
                    {formatCurrency(calculation.totalRepayment, data.asset)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Risk Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm">
              <p className="text-yellow-800 font-medium mb-1">Important Notice</p>
              <p className="text-yellow-700">
                {type === 'lend' 
                  ? 'Lending involves risk. Interest rates may vary and principal is not guaranteed.'
                  : 'Failure to repay may result in liquidation of your collateral. Ensure you can meet payment obligations.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}