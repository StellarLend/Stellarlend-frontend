'use client';

import { useEffect, useState } from 'react';
import { LendingData, CalculationResult } from '@/app/lending/page';

interface InterestCalculatorProps {
  data: LendingData;
  type: 'lend' | 'borrow';
  onCalculate: (result: CalculationResult) => void;
}

export default function InterestCalculator({ data, type, onCalculate }: InterestCalculatorProps) {
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);

  useEffect(() => {
    if (data.amount > 0 && data.interestRate > 0) {
      calculateInterest();
    }
  }, [data.amount, data.interestRate, data.duration, type]);

  const calculateInterest = () => {
    const { amount, interestRate, duration = 30 } = data;

    if (type === 'lend') {
      // Lending calculations
      const dailyRate = interestRate / 365 / 100;
      const dailyEarnings = amount * dailyRate;
      const totalEarnings = dailyEarnings * duration;

      const result: CalculationResult = {
        totalEarnings,
        dailyEarnings,
      };

      setCalculation(result);
      onCalculate(result);
    } else {
      // Borrowing calculations
      const monthlyRate = interestRate / 12 / 100;
      const numberOfPayments = Math.ceil(duration / 30);

      const monthlyPayment = numberOfPayments > 0
        ? (amount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
          (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
        : 0;

      const totalRepayment = monthlyPayment * numberOfPayments;
      const totalInterest = totalRepayment - amount;

      const result: CalculationResult = {
        totalEarnings: totalInterest,
        dailyEarnings: totalInterest / duration,
        totalRepayment,
        monthlyPayment,
      };

      setCalculation(result);
      onCalculate(result);
    }
  };

  if (!calculation && data.amount > 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse h-full flex flex-col justify-center">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-6"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (!calculation || data.amount <= 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full flex flex-col justify-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {type === 'lend' ? 'Earnings Calculator' : 'Loan Calculator'}
        </h3>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">
            Enter an amount above 0 to see <br/> estimated calculations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {type === 'lend' ? 'Earnings Summary' : 'Loan Summary'}
      </h3>
      <div className="space-y-2 text-sm text-gray-700">
        {type === 'lend' ? (
          <>
            <div>
              <span className="font-medium">Daily Earnings:</span> ${calculation.dailyEarnings.toFixed(2)}
            </div>
            <div>
              <span className="font-medium">Total Earnings:</span> ${calculation.totalEarnings.toFixed(2)}
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="font-medium">Monthly Payment:</span> ${calculation.monthlyPayment?.toFixed(2)}
            </div>
            <div>
              <span className="font-medium">Total Repayment:</span> ${calculation.totalRepayment?.toFixed(2)}
            </div>
            <div>
              <span className="font-medium">Total Interest:</span> ${calculation.totalEarnings.toFixed(2)}
            </div>
            <div>
              <span className="font-medium">Daily Interest:</span> ${calculation.dailyEarnings.toFixed(2)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
