'use client';

import { useState, useEffect } from 'react';
import { LendingData } from '@/app/lending/page';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Borrow Against Collateral</h2>
        <p className="text-gray-600 text-sm">
          Borrow assets by providing collateral. Minimum 150% collateralization required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Borrow Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Asset to Borrow
          </label>
          <div className="grid grid-cols-2 gap-3">
            {ASSETS.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, asset: asset.symbol }))}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  formData.asset === asset.symbol
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{asset.symbol}</span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {INTEREST_RATES[asset.symbol as keyof typeof INTEREST_RATES]}% APR
                  </span>
                </div>
                <div className="text-sm text-gray-600">{asset.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Borrow Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount to Borrow
          </label>
          <input
            type="number"
            value={formData.amount || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.amount ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter amount"
            step="0.01"
          />
          {errors.amount && (
            <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
          )}
        </div>

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
                onClick={() => setFormData(prev => ({ ...prev, duration: duration.days }))}
                className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                  formData.duration === duration.days
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{duration.label}</div>
                <div className="text-xs text-gray-500">{duration.days} days</div>
              </button>
            ))}
          </div>
          {errors.duration && (
            <p className="mt-1 text-sm text-red-600">{errors.duration}</p>
          )}
        </div>

        {/* Collateral Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collateral Asset
          </label>
          <div className="grid grid-cols-2 gap-3">
            {ASSETS.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, collateral: asset.symbol }))}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  formData.collateral === asset.symbol
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{asset.symbol}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Balance: {asset.balance.toLocaleString()} {asset.symbol}
                </div>
              </button>
            ))}
          </div>
          {errors.collateral && (
            <p className="mt-1 text-sm text-red-600">{errors.collateral}</p>
          )}
        </div>

        {/* Collateral Requirements */}
        {formData.amount > 0 && (
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h3 className="font-medium text-yellow-800 mb-2">Collateral Requirements</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-yellow-700">Loan Amount:</span>
                <span className="font-medium">{formData.amount.toLocaleString()} {formData.asset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-700">Required Collateral (150%):</span>
                <span className="font-medium">{requiredCollateral.toLocaleString()} {formData.collateral}</span>
              </div>
              {collateralAsset && (
                <div className="flex justify-between">
                  <span className="text-yellow-700">Available Balance:</span>
                  <span className={`font-medium ${
                    collateralAsset.balance >= requiredCollateral ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {collateralAsset.balance.toLocaleString()} {formData.collateral}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Terms */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Borrowing Terms</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Interest rate: {interestRate}% APR</li>
            <li>• Minimum collateralization ratio: 150%</li>
            <li>• Liquidation threshold: 120%</li>
            <li>• Early repayment allowed without penalty</li>
          </ul>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Review Loan Request
        </button>
      </form>
    </div>
  );
}