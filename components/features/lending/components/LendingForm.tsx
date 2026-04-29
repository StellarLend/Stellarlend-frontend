'use client';

import { useState, useEffect } from 'react';
import { LendingData } from '@/app/lending/page';
import { Input } from '@/components/shared/ui/Input';
import Button from '@/components/shared/ui/Button';
import { cn } from '@/lib/utils/cn';

interface LendingFormProps {
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
  XLM: { min: 5.0, max: 12.0, default: 8.5 },
  USDC: { min: 4.0, max: 10.0, default: 6.5 },
  BTC: { min: 3.0, max: 8.0, default: 5.5 },
  ETH: { min: 3.5, max: 9.0, default: 6.0 },
};

export default function LendingForm({ onSubmit, initialData }: LendingFormProps) {
  const [formData, setFormData] = useState<LendingData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const selectedAsset = ASSETS.find(a => a.symbol === formData.asset);
  const rates = INTEREST_RATES[formData.asset as keyof typeof INTEREST_RATES];

  useEffect(() => {
    if (rates) {
      setFormData(prev => ({ ...prev, interestRate: rates.default }));
    }
  }, [formData.asset, rates]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (selectedAsset && formData.amount > selectedAsset.balance) {
      newErrors.amount = `Insufficient balance. Maximum available: ${selectedAsset.balance.toLocaleString()} ${formData.asset}`;
    }

    if (!formData.interestRate || formData.interestRate < rates.min || formData.interestRate > rates.max) {
      newErrors.interestRate = `Interest rate must be between ${rates.min}% and ${rates.max}%`;
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
        // Simulate validation/processing
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

  const handleMaxAmount = () => {
    if (selectedAsset) {
      setFormData(prev => ({ ...prev, amount: selectedAsset.balance }));
      if (errors.amount) {
        setErrors(prev => {
          const next = { ...prev };
          delete next.amount;
          return next;
        });
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Lend Your Assets</h2>
        <p className="text-gray-600 text-sm">
          Choose an asset and amount to lend, then set your desired interest rate
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
        {/* Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Asset
          </label>
          <div className="grid grid-cols-2 gap-4">
            {ASSETS.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, asset: asset.symbol }));
                  setErrors({});
                }}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200 text-left relative overflow-hidden group",
                  formData.asset === asset.symbol
                    ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/30"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "font-bold text-sm",
                    formData.asset === asset.symbol ? "text-green-700" : "text-gray-900"
                  )}>
                    {asset.symbol}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold bg-white px-1.5 py-0.5 rounded border border-gray-100">
                    {asset.name}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  Balance: {asset.balance.toLocaleString()}
                </div>
                {formData.asset === asset.symbol && (
                  <div className="absolute top-0 right-0 p-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div className="relative">
          <Input
            label="Amount to Lend"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.amount || ''}
            error={errors.amount}
            helperText={selectedAsset ? `Available: ${selectedAsset.balance.toLocaleString()} ${formData.asset}` : undefined}
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
          <button
            type="button"
            onClick={handleMaxAmount}
            className="absolute right-3 top-[38px] text-xs font-bold text-green-600 hover:text-green-700 bg-green-50 px-2 py-1 rounded transition-colors"
          >
            MAX
          </button>
        </div>

        {/* Interest Rate */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Interest Rate (% APY)
            </label>
            <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
              {formData.interestRate.toFixed(1)}% APY
            </span>
          </div>
          
          <div className="px-1">
            <input
              type="range"
              min={rates.min}
              max={rates.max}
              step="0.1"
              value={formData.interestRate}
              onChange={(e) => setFormData(prev => ({ ...prev, interestRate: parseFloat(e.target.value) }))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tighter">
              <span>MIN: {rates.min}%</span>
              <span>DEFAULT: {rates.default}%</span>
              <span>MAX: {rates.max}%</span>
            </div>
          </div>
          
          {errors.interestRate && (
            <p className="text-xs text-red-500 font-medium" role="alert" aria-live="polite">{errors.interestRate}</p>
          )}
        </div>

        {/* Terms */}
        <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
          <h3 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wider">Lending Terms</h3>
          <ul className="text-xs text-gray-500 space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Minimum lending period: 7 days
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Interest is calculated daily and compounded
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Withdraw funds anytime after minimum period
            </li>
            <li className="flex items-start gap-2 text-gray-400">
              <span className="mt-0.5">ℹ</span>
              Early withdrawal may incur a 0.5% penalty fee
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="success"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
        >
          Review Lending Offer
        </Button>
      </form>
    </div>
  );
}