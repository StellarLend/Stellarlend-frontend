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

  if (!calculation || data.amount <= 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {type === 'lend' ? 'Earnings Calculator' : 'Loan Calculator'}
        </h3>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">
            Enter amount and rate to see calculations
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
