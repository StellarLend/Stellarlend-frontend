'use client';

import { useState, useEffect } from 'react';
import LendingForm from '@/components/features/lending/components/LendingForm';
import BorrowingForm from '@/components/features/lending/components/BorrowingForm';
import InterestCalculator from '@/components/features/lending/components/InterestCalculator';
import TransactionSummary from '@/components/features/lending/components/TransactionSummary';
import ConfirmModal from '@/components/features/lending/components/ConfirmModal';
import TabSelector from '@/components/features/lending/components/TabSelector';
import { PageHeader } from '@/components/shared/common';

export type { LendingData, CalculationResult } from '@/lib/lending/types';
import type { LendingData, CalculationResult } from '@/lib/lending/types';

export default function LendingPage() {
  const [activeTab, setActiveTab] = useState<'lend' | 'borrow'>('lend');
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

  const handleConfirm = async () => {
    console.log('Submitting:', activeTab === 'lend' ? lendingData : borrowingData);
    setShowConfirmModal(false);

  };

  const currentData = activeTab === 'lend' ? lendingData : borrowingData;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(21,163,80,0.24)_0%,rgba(21,163,80,0.1)_38%,rgba(248,250,252,0)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-green-600 via-emerald-500 to-black" />
          <div className="p-6 sm:p-8">
            <PageHeader
              tone="light"
              title="Lending & Borrowing"
              description="Earn interest by lending your assets or borrow against your collateral."
              className="mb-0"
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
          <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {activeTab === 'lend' ? (
              <LendingForm
                onSubmit={handleLendingSubmit}
                initialData={lendingData}
              />
            ) : (
              <BorrowingForm
                onSubmit={handleBorrowingSubmit}
                initialData={borrowingData}
              />
            )}
          </div>

          <div className="space-y-6">
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
          </div>
        </div>

        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirm}
          data={currentData}
          calculation={calculationResult}
          type={activeTab}
        />
      </div>
    </div>
  );
}
