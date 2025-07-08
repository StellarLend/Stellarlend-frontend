'use client';

import { useState, useEffect } from 'react';
import { LendingData } from '@/app/lending/page';

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
      newErrors.amount = 'Insufficient balance';
    }

    if (!formData.interestRate || formData.interestRate < rates.min || formData.interestRate > rates.max) {
      newErrors.interestRate = `Interest rate must be between ${rates.min}% and ${rates.max}%`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleMaxAmount = () => {
    if (selectedAsset) {
      setFormData(prev => ({ ...prev, amount: selectedAsset.balance }));
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Asset
          </label>
          <div className="grid grid-cols-2 gap-3">
            {ASSETS.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, asset: asset.symbol }))}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  formData.asset === asset.symbol
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{asset.symbol}</span>
                  <span className="text-xs text-gray-500">{asset.name}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Balance: {asset.balance.toLocaleString()} {asset.symbol}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount to Lend
          </label>
          <div className="relative">
            <input
              type="number"
              value={formData.amount || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 text-black focus:ring-green-500 focus:border-transparent ${
                errors.amount ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter amount"
              step="0.01"
            />
            <button
              type="button"
              onClick={handleMaxAmount}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-green-600 hover:text-green-700 font-medium"
            >
              MAX
            </button>
          </div>
          {errors.amount && (
            <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
          )}
          {selectedAsset && (
            <p className="mt-1 text-sm text-gray-500">
              Available: {selectedAsset.balance.toLocaleString()} {formData.asset}
            </p>
          )}
        </div>

        {/* Interest Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Interest Rate (% APY)
          </label>
          <div className="space-y-3">
            <input
              type="range"
              min={rates.min}
              max={rates.max}
              step="0.1"
              value={formData.interestRate}
              onChange={(e) => setFormData(prev => ({ ...prev, interestRate: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{rates.min}%</span>
              <span className="font-medium text-gray-900">{formData.interestRate}% APY</span>
              <span>{rates.max}%</span>
            </div>
          </div>
          {errors.interestRate && (
            <p className="mt-1 text-sm text-red-600">{errors.interestRate}</p>
          )}
        </div>

        {/* Terms */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Lending Terms</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Minimum lending period: 7 days</li>
            <li>• Interest is calculated daily and compounded</li>
            <li>• You can withdraw your funds anytime after the minimum period</li>
            <li>• Early withdrawal may incur a 0.5% penalty fee</li>
          </ul>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Review Lending Offer
        </button>
      </form>
    </div>
  );
}