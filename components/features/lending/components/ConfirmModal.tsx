'use client';

import { useState } from 'react';
import { LendingData, CalculationResult } from '@/app/lending/page';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: LendingData;
  calculation: CalculationResult | null;
  type: 'lend' | 'borrow';
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  data, 
  calculation, 
  type 
}: ConfirmModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!hasAgreed) return;
    
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4 
    })} ${currency}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Confirm {type === 'lend' ? 'Lending' : 'Borrowing'} Transaction
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Transaction Details */}
          <div className="mb-6">
            <div className={`rounded-lg p-4 mb-4 ${
              type === 'lend' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="text-center">
                <div className={`text-2xl font-bold mb-1 ${
                  type === 'lend' ? 'text-green-700' : 'text-blue-700'
                }`}>
                  {formatCurrency(data.amount, data.asset)}
                </div>
                <div className={`text-sm ${
                  type === 'lend' ? 'text-green-600' : 'text-blue-600'
                }`}>
                  {type === 'lend' ? 'Amount to Lend' : 'Amount to Borrow'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Interest Rate</span>
                <span className="font-medium">
                  {data.interestRate.toFixed(1)}% {type === 'lend' ? 'APY' : 'APR'}
                </span>
              </div>

              {type === 'borrow' && data.duration && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan Duration</span>
                  <span className="font-medium">{data.duration} days</span>
                </div>
              )}

              {calculation && (
                <>
                  {type === 'lend' ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Daily Earnings</span>
                        <span className="font-medium text-green-600">
                          +{formatCurrency(calculation.dailyEarnings, data.asset)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-medium">Total Expected Return</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(data.amount + calculation.totalEarnings, data.asset)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {calculation.monthlyPayment && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Monthly Payment</span>
                          <span className="font-medium text-blue-600">
                            {formatCurrency(calculation.monthlyPayment, data.asset)}
                          </span>
                        </div>
                      )}
                      {calculation.totalRepayment && (
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-medium">Total Repayment</span>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(calculation.totalRepayment, data.asset)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Collateral Info for Borrowing */}
            {type === 'borrow' && data.collateral && data.collateralAmount && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Collateral Required</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-700">Asset & Amount</span>
                  <span className="font-medium">
                    {formatCurrency(data.collateralAmount, data.collateral)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Terms Agreement */}
          <div className="mb-6">
            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                I understand and agree to the{' '}
                <button className="text-green-600 hover:text-green-700 underline">
                  terms and conditions
                </button>
                {type === 'borrow' && (
                  <span>
                    {' '}and acknowledge that my collateral may be liquidated if I fail to repay the loan
                  </span>
                )}
                .
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              disabled={isConfirming}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasAgreed || isConfirming}
              className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-all duration-200 ${
                hasAgreed && !isConfirming
                  ? type === 'lend'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isConfirming ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </div>
              ) : (
                `Confirm ${type === 'lend' ? 'Lending' : 'Borrowing'}`
              )}
            </button>
          </div>

          {/* Security Notice */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start">
              <svg className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-xs text-gray-600">
                This transaction will be recorded on the Stellar blockchain and cannot be reversed once confirmed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}