import type { LendingData, CalculationResult } from '@/lib/lending/types';

interface TransactionSummaryProps {
  data: LendingData;
  calculation: CalculationResult | null;
  type: 'lend' | 'borrow' | 'repay' | 'withdraw';
}

export default function TransactionSummary({ data, calculation, type }: TransactionSummaryProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [toast, setToast] = useState<{
    variant: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);

  const formatCurrency = (amount: number, currency: string) => {
    return `${formatCurrencyUtil(amount, 4)} ${currency}`;
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

  /**
   * Serialises the transaction breakdown to plain text
   * for clipboard export.
   * 
   * @security Never includes session tokens, wallet keys,
   * or any secret values — display values only.
   */
  function buildSummaryText(): string {
    const lines = [
      'Transaction Summary',
      '==================',
      '',
      `Type:               ${type === 'lend' ? 'Lending' : 'Borrowing'}`,
      `Asset:              ${data.asset}`,
      `Amount:             ${formatCurrency(data.amount, data.asset)}`,
      `Interest Rate:      ${data.interestRate.toFixed(1)}% ${type === 'lend' ? 'APY' : 'APR'}`,
    ];

    if (type === 'borrow' && data.duration) {
      lines.push(`Duration:           ${data.duration} days`);
    }

    lines.push(`Start Date:         ${formatDate(0)}`);

    if (data.duration) {
      lines.push(`End Date:           ${formatDate(data.duration)}`);
    }

    if (type === 'borrow' && data.collateral && data.collateralAmount) {
      lines.push('');
      lines.push('Collateral');
      lines.push('----------');
      lines.push(`Asset:              ${data.collateral}`);
      lines.push(`Amount:             ${formatCurrency(data.collateralAmount, data.collateral)}`);
      lines.push(`Ratio:              150%`);
    }

    if (calculation) {
      lines.push('');
      lines.push(type === 'lend' ? 'Expected Returns' : 'Repayment Details');
      lines.push(type === 'lend' ? '----------------' : '-------------------');

      if (type === 'lend') {
        lines.push(`Daily Earnings:     ${formatCurrency(calculation.dailyEarnings, data.asset)}`);
        lines.push(`Total Earnings:     ${formatCurrency(calculation.totalEarnings, data.asset)}`);
        lines.push(`Total Return:       ${formatCurrency(data.amount + calculation.totalEarnings, data.asset)}`);
      } else {
        if (calculation.monthlyPayment) {
          lines.push(`Monthly Payment:    ${formatCurrency(calculation.monthlyPayment, data.asset)}`);
        }
        lines.push(`Total Interest:     ${formatCurrency(calculation.totalEarnings, data.asset)}`);
        if (calculation.totalRepayment) {
          lines.push(`Total Repayment:    ${formatCurrency(calculation.totalRepayment, data.asset)}`);
        }
      }
    }

    lines.push('');
    lines.push(`Exported at:        ${new Date().toISOString()}`);

    return lines.join('\n');
  }

  const handleCopy = async () => {
    const text = buildSummaryText();

    try {
      const result = await copyToClipboard(text);

      if (result.success) {
        setCopyStatus('copied');
        setToast({
          variant: 'success',
          title: 'Copied!',
          description: 'Summary copied to clipboard.',
        });
        setTimeout(() => {
          setCopyStatus('idle');
          setToast(null);
        }, 2000);
      } else {
        setCopyStatus('failed');
        setToast({
          variant: 'error',
          title: 'Copy Failed',
          description: 'Failed to copy summary to clipboard.',
        });
        setTimeout(() => {
          setCopyStatus('idle');
          setToast(null);
        }, 2000);
      }
    } catch {
      setCopyStatus('failed');
      setToast({
        variant: 'error',
        title: 'Copy Failed',
        description: 'An unexpected error occurred while copying.',
      });
      setTimeout(() => {
        setCopyStatus('idle');
        setToast(null);
      }, 2000);
    }
  };

  if (!data || data.amount <= 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center py-10 h-full flex flex-col justify-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm font-medium">Summary will appear here<br/>once you enter valid details</p>
      </div>
    );
  }

  if (!calculation && (type === 'lend' || type === 'borrow')) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse h-full flex flex-col justify-center">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-6"></div>
        <div className="h-20 bg-gray-100 rounded-lg mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded w-full"></div>
          <div className="h-4 bg-gray-100 rounded w-full"></div>
          <div className="h-4 bg-gray-100 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Transaction Summary
        </h3>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={
            copyStatus === 'copied'
              ? 'Summary copied to clipboard'
              : 'Copy transaction summary to clipboard'
          }
          aria-live="polite"
          disabled={copyStatus !== 'idle'}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
            copyStatus === 'idle'
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              : copyStatus === 'copied'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
          } ${copyStatus !== 'idle' ? 'cursor-not-allowed opacity-75' : ''}`}
        >
          {copyStatus === 'copied' ? (
            <>
              <span>✓</span>
              <span>Copied</span>
            </>
          ) : copyStatus === 'failed' ? (
            <>
              <span>✗</span>
              <span>Failed</span>
            </>
          ) : (
            <>
              <Copy size={18} />
              <span>Copy Summary</span>
            </>
          )}
        </button>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {copyStatus === 'copied' ? 'Summary copied to clipboard' : ''}
        {copyStatus === 'failed' ? 'Failed to copy summary' : ''}
      </span>

      <div className="space-y-4">
        {/* Header Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {type === 'lend' ? 'Lending' : type === 'borrow' ? 'Borrowing' : type === 'repay' ? 'Repaying' : 'Withdrawing'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              type === 'lend'
                ? 'bg-green-100 text-green-800'
                : type === 'borrow'
                  ? 'bg-blue-100 text-blue-800'
                  : type === 'repay'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-purple-100 text-purple-800'
            }`}>
              {type.toUpperCase()}
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

        {/* Financial Summary — lend / borrow */}
        {(type === 'lend' || type === 'borrow') && calculation && (
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
        )}

        {/* Repayment Breakdown Visualization — borrow */}
        {type === 'borrow' && calculation && (
          <div className="mt-6">
            <table className="w-full text-sm border border-gray-200 mb-4" aria-label="Repayment breakdown table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left">Component</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-1">Principal</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(data.amount, data.asset)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1">Total Interest</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(calculation.totalEarnings, data.asset)}</td>
                </tr>
                <tr className="font-medium border-t border-gray-200">
                  <td className="px-2 py-1">Total Repayment</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(calculation.totalRepayment, data.asset)}</td>
                </tr>
              </tbody>
            </table>
            <div className="w-full bg-gray-200 rounded h-4 flex overflow-hidden" aria-label="Repayment breakdown bar" role="img">
              <div
                className="bg-green-600"
                style={{ width: `${(data.amount / (calculation.totalRepayment)) * 100}%` }}
              />
              <div
                className="bg-red-600"
                style={{ width: `${(calculation.totalEarnings / (calculation.totalRepayment)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1 text-gray-600">
              <span>Principal</span>
              <span>Interest</span>
            </div>
          </div>
        )}

        {/* Repay breakdown */}
        {type === 'repay' && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Repayment Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Repaid</span>
                <span className="font-medium text-orange-600">
                  {formatCurrency(data.amount, data.asset)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining Debt</span>
                <span className="font-medium">
                  {(data.remainingDebt ?? 0) === 0
                    ? <span className="text-green-600">Debt cleared</span>
                    : formatCurrency(data.remainingDebt ?? 0, data.asset)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">New Health Factor</span>
                <span className="font-semibold">
                  {data.healthFactorAfter === undefined || data.healthFactorAfter === null
                    ? '—'
                    : !Number.isFinite(data.healthFactorAfter)
                      ? <span className="text-green-600">Debt cleared</span>
                      : data.healthFactorAfter.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Withdraw breakdown */}
        {type === 'withdraw' && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Withdrawal Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Redeemed</span>
                <span className="font-medium text-purple-600">
                  {formatCurrency(data.amount, data.asset)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining Supply</span>
                <span className="font-medium">
                  {formatCurrency(data.remainingDebt ?? 0, data.asset)}
                </span>
              </div>
              {(data.outstandingDebt ?? 0) > 0 && (
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">New Health Factor</span>
                  <span className="font-semibold">
                    {data.healthFactorAfter === undefined || data.healthFactorAfter === null
                      ? '—'
                      : data.healthFactorAfter.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      {toast && (
        <Toast
          variant={toast.variant}
          title={toast.title}
          description={toast.description}
        />
      )}
    </div>
  );
}