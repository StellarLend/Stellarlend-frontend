'use client';

import { useState, useEffect } from 'react';
import LendingForm from '@/components/features/lending/components/LendingForm';
import BorrowingForm from '@/components/features/lending/components/BorrowingForm';
import RepayForm from '@/components/features/lending/components/RepayForm';
import InterestCalculator from '@/components/features/lending/components/InterestCalculator';
import TransactionSummary from '@/components/features/lending/components/TransactionSummary';
import ConfirmModal from '@/components/features/lending/components/ConfirmModal';
import TabSelector from '@/components/features/lending/components/TabSelector';
import { PageHeader } from '@/components/shared/common';

export type { LendingData, CalculationResult } from '@/lib/lending/types';
import type { LendingData, CalculationResult } from '@/lib/lending/types';

export default function LendingPage() {
  const [activeTab, setActiveTab] = useState<'lend' | 'borrow' | 'repay'>('lend');
  const [lendingData, setLendingData] = useState<LendingData>({
    asset: 'XLM',
    amount: 0,
    interestRate: 8.5,
  });
  const [borrowingData, setBorrowingData] = useState<LendingData>({
    asset: 'XLM',
    amount: 0,
    interestRate: 12.0,
    duration: 30,
    collateral: 'XLM',
    collateralAmount: 0,
  });
  const [repayData, setRepayData] = useState<LendingData>({
    asset: 'XLM',
    amount: 0,
    interestRate: 0,
  });
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Hydrate default interest rates from the live /api/markets endpoint.
  // Falls back silently to the hardcoded values above if the fetch fails.
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/markets?asset=XLM', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { markets?: Array<{ asset: string; supplyApr: number; borrowApr: number }> } | null) => {
        if (!data?.markets) return;
        const xlm = data.markets.find((m) => m.asset === 'XLM');
        if (!xlm) return;
        setLendingData((prev) => ({ ...prev, interestRate: xlm.supplyApr }));
        setBorrowingData((prev) => ({ ...prev, interestRate: xlm.borrowApr }));
      })
      .catch(() => { /* keep hardcoded fallback */ });
    return () => controller.abort();
  }, []);

  const handleLendingSubmit = (data: LendingData) => {
    setLendingData(data);
    setShowConfirmModal(true);
  };

  const handleBorrowingSubmit = (data: LendingData) => {
    setBorrowingData(data);
    setShowConfirmModal(true);
  };

  const handleRepaySubmit = (data: { asset: string; amount: number; interestRate: number }) => {
    setRepayData({
      asset: data.asset,
      amount: data.amount,
      interestRate: data.interestRate,
    });
    setCalculationResult({
      totalEarnings: 0,
      dailyEarnings: 0,
      totalRepayment: data.amount,
      monthlyPayment: 0,
    });
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    console.log('Submitting:', activeTab === 'lend' ? lendingData : activeTab === 'borrow' ? borrowingData : repayData);
    setShowConfirmModal(false);
  };

  const currentData = activeTab === 'lend' ? lendingData : activeTab === 'borrow' ? borrowingData : repayData;

  return (
   <div className="min-h-screen p-6 bg-gradient-to-b from-green-700 to-black text-black">

      <div className="max-w-7xl mx-auto">
  
        <PageHeader
          title="Lending & Borrowing"
          description="Earn interest by lending your assets or borrow against your collateral."
        />

       
        <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">

          <div className="lg:col-span-2">
            {activeTab === 'lend' ? (
              <LendingForm
                onSubmit={handleLendingSubmit}
                initialData={lendingData}
              />
            ) : activeTab === 'borrow' ? (
              <BorrowingForm
                onSubmit={handleBorrowingSubmit}
                initialData={borrowingData}
              />
            ) : (
              <RepayForm
                onSubmit={handleRepaySubmit}
              />
            )}
          </div>


          <div className="space-y-6">
            {activeTab !== 'repay' ? (
              <>
                <InterestCalculator
                  data={currentData}
                  type={activeTab}
                  onCalculate={setCalculationResult}
                />
                {calculationResult && (
                  <TransactionSummary
                    data={currentData}
                    calculation={calculationResult}
                    type={activeTab}
                  />
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Repayment Guide</h3>
                <ul className="space-y-3 text-sm text-gray-600 font-medium">
                  <li className="flex gap-2">
                    <span className="text-green-600 font-bold">1.</span>
                    Select your active borrow position.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600 font-bold">2.</span>
                    Enter the amount of the asset you want to pay back.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600 font-bold">3.</span>
                    Confirm and submit the repayment transaction.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600 font-bold">4.</span>
                    Your health factor will improve once the repayment is processed.
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>


        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirm}
          data={currentData}
          calculation={calculationResult}
          type={activeTab === 'repay' ? 'borrow' : activeTab}
        />
      </div>
    </div>
  );
}