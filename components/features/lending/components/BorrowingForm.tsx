'use client';

import { useState, useEffect } from 'react';
import { LendingData } from '@/app/lending/page';
import { Input } from '@/components/shared/ui/Input';
import Button from '@/components/shared/ui/Button';
import { cn } from '@/lib/utils/cn';

interface BorrowingFormProps {
  onSubmit: (data: LendingData) => void;
  initialData: LendingData;
}

const ASSETS = [
  { symbol: 'XLM', name: 'Stellar Lumens', balance: 3750.00 },
  { symbol: 'USDC', name: 'USD Coin', balance: 1250.00 },
  { symbol: 'BTC', name: 'Bitcoin', balance: 0.15 },
  { symbol: 'ETH', name: 'Ethereum', balance: 2.5 },
];

const INTEREST_RATES = {
  XLM: 12.0,
  USDC: 10.5,
  BTC: 8.0,
  ETH: 9.5,
};

const LOAN_DURATIONS = [
  { days: 7, label: '1 Week' },
  { days: 14, label: '2 Weeks' },
  { days: 30, label: '1 Month' },
  { days: 60, label: '2 Months' },
  { days: 90, label: '3 Months' },
  { days: 180, label: '6 Months' },
];

export default function BorrowingForm({ onSubmit, initialData }: BorrowingFormProps) {
  const [formData, setFormData] = useState<LendingData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const selectedAsset = ASSETS.find(a => a.symbol === formData.asset);
  const collateralAsset = ASSETS.find(a => a.symbol === formData.collateral);
  const interestRate = INTEREST_RATES[formData.asset as keyof typeof INTEREST_RATES];

  // Calculate required collateral (150% of loan amount)
  const requiredCollateral = formData.amount * 1.5;

  useEffect(() => {
    setFormData(prev => ({ 
      ...prev, 
      interestRate,
      collateralAmount: requiredCollateral 
    }));
  }, [formData.amount, interestRate, requiredCollateral]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!formData.duration) {
      newErrors.duration = 'Please select a loan duration';
    }

    if (!formData.collateral) {
      newErrors.collateral = 'Please select collateral asset';
    }

    if (collateralAsset && formData.collateralAmount && formData.collateralAmount > collateralAsset.balance) {
      newErrors.collateralAmount = 'Insufficient collateral balance';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('idle');
    setSubmitMessage('');
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        setSubmitStatus('success');
        setSubmitMessage('Details validated successfully.');
        onSubmit(formData);
      } catch (err) {
        setSubmitStatus('error');
        setSubmitMessage('An error occurred during validation.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setSubmitStatus('error');
      setSubmitMessage('Please fix the errors in the form before continuing.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Borrow Against Collateral</h2>
        <p className="text-gray-600 text-sm font-medium">
          Borrow assets by providing collateral. Minimum 150% collateralization required.
        </p>
      </div>

      {submitMessage && (
        <div
          className={cn(
            "p-4 rounded-xl mb-6 text-sm font-medium",
            submitStatus === 'success' 
              ? "bg-green-50 text-green-800 border border-green-200" 
              : "bg-red-50 text-red-800 border border-red-200"
          )}
          role="alert"
          aria-live="polite"
        >
          {submitMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Borrow Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Asset to Borrow
          </label>
          <div className="grid grid-cols-2 gap-4">
            {ASSETS.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, asset: asset.symbol }))}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200 text-left relative overflow-hidden",
                  formData.asset === asset.symbol
                    ? "border-[#2600FF] bg-blue-50 ring-1 ring-[#2600FF]"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/30"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "font-bold text-sm",
                    formData.asset === asset.symbol ? "text-[#2600FF]" : "text-gray-900"
                  )}>
                    {asset.symbol}
                  </span>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    {INTEREST_RATES[asset.symbol as keyof typeof INTEREST_RATES]}% APR
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-medium">{asset.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Borrow Amount */}
        <Input
          label="Amount to Borrow"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.amount || ''}
          error={errors.amount}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }));
            if (errors.amount) {
              setErrors(prev => {
                const next = { ...prev };
                delete next.amount;
                return next;
              });
            }
          }}
        />

        {/* Loan Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Loan Duration
          </label>
          <div className="grid grid-cols-3 gap-3">
            {LOAN_DURATIONS.map(duration => (
              <button
                key={duration.days}
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, duration: duration.days }));
                  if (errors.duration) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.duration;
                      return next;
                    });
                  }
                }}
                className={cn(
                  "p-3 rounded-xl border-2 text-center transition-all duration-200",
                  formData.duration === duration.days
                    ? "border-[#2600FF] bg-blue-50 text-[#2600FF] ring-1 ring-[#2600FF]"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/30 text-gray-600"
                )}
              >
                <div className="font-bold text-sm">{duration.label}</div>
                <div className="text-[10px] opacity-70 font-semibold">{duration.days} days</div>
              </button>
            ))}
          </div>
          {errors.duration && (
            <p className="text-xs text-red-500 font-medium mt-2" role="alert" aria-live="polite">{errors.duration}</p>
          )}
        </div>

        {/* Collateral Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Collateral Asset
          </label>
          <div className="grid grid-cols-2 gap-4">
            {ASSETS.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, collateral: asset.symbol }));
                  if (errors.collateral) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.collateral;
                      return next;
                    });
                  }
                }}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                  formData.collateral === asset.symbol
                    ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/30"
                )}
              >
                <div className="font-bold text-sm mb-1">{asset.symbol}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  Bal: {asset.balance.toLocaleString()}
                </div>
              </button>
            ))}
          </div>
          {errors.collateral && (
            <p className="text-xs text-red-500 font-medium mt-2" role="alert" aria-live="polite">{errors.collateral}</p>
          )}
        </div>

        {/* Collateral Requirements */}
        {formData.amount > 0 && (
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 space-y-3">
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Collateral Requirements</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-amber-700">Loan Amount:</span>
                <span className="text-gray-900">{formData.amount.toLocaleString()} {formData.asset}</span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-amber-700">Required (150%):</span>
                <span className="font-bold text-[#2600FF]">{requiredCollateral.toLocaleString()} {formData.collateral}</span>
              </div>
              {collateralAsset && (
                <div className="flex justify-between text-xs font-medium border-t border-amber-200 pt-2.5">
                  <span className="text-amber-700">Your Balance:</span>
                  <span className={cn(
                    "font-bold",
                    collateralAsset.balance >= requiredCollateral ? "text-green-600" : "text-red-600"
                  )}>
                    {collateralAsset.balance.toLocaleString()} {formData.collateral}
                  </span>
                </div>
              )}
            </div>
            {errors.collateralAmount && (
              <p className="text-xs text-red-500 font-bold" role="alert" aria-live="polite">{errors.collateralAmount}</p>
            )}
          </div>
        )}

        {/* Terms */}
        <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
          <h3 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wider">Borrowing Terms</h3>
          <ul className="text-xs text-gray-500 space-y-2 font-medium">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Interest rate: {interestRate}% APR
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Min collateralization: 150%
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Liquidation threshold: 120%
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Early repayment allowed
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
        >
          Review Loan Request
        </Button>
      </form>
    </div>
  );
}