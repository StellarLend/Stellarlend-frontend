"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import useTxStatus from "@/lib/tx/useTxStatus";
import { Toast } from "@/components/shared/common";
import LendingForm from "@/components/features/lending/components/LendingForm";
import TabSelector from "@/components/features/lending/components/TabSelector";
import { PageHeader } from "@/components/shared/common";
import { Skeleton } from "@/components/shared/common/Skeleton";
import type { LendingActionType } from "@/lib/lending/types";

export type { LendingData, CalculationResult } from "@/lib/lending/types";
import type { LendingData, CalculationResult } from "@/lib/lending/types";

const BorrowingForm = dynamic(
  () => import("@/components/features/lending/components/BorrowingForm"),
  {
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  },
);
const RepayForm = dynamic(
  () => import("@/components/features/lending/components/RepayForm"),
  {
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  },
);
const WithdrawForm = dynamic(
  () => import("@/components/features/lending/components/WithdrawForm"),
  {
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  },
);
const InterestCalculator = dynamic(
  () => import("@/components/features/lending/components/InterestCalculator"),
  {
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  },
);
const TransactionSummary = dynamic(
  () => import("@/components/features/lending/components/TransactionSummary"),
  {
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-40 w-full" />
      </div>
    ),
  },
);
const ConfirmModal = dynamic(
  () => import("@/components/features/lending/components/ConfirmModal"),
);

export default function LendingPage() {
  const [activeTab, setActiveTab] = useState<LendingActionType>("lend");
  const [lendingData, setLendingData] = useState<LendingData>({
    asset: "XLM",
    amount: 0,
    interestRate: 8.5,
  });
  const [borrowingData, setBorrowingData] = useState<LendingData>({
    asset: "XLM",
    amount: 0,
    interestRate: 12.0,
    duration: 30,
    collateral: "XLM",
    collateralAmount: 0,
  });
  const [repayData, setRepayData] = useState<LendingData>({
    asset: "XLM",
    amount: 0,
    interestRate: 12.0,
    duration: 30,
    collateral: "XLM",
    collateralAmount: 5000,
    positionId: "xlm-borrow-001",
    outstandingDebt: 1500,
    remainingDebt: 1500,
    healthFactorBefore: 1.5,
    healthFactorAfter: 1.5,
  });
  const [withdrawData, setWithdrawData] = useState<LendingData>({
    asset: "XLM",
    amount: 0,
    interestRate: 0,
    positionId: "xlm-supply-001",
    outstandingDebt: 1500,
    remainingDebt: 5000,
    collateralAmount: 2250,
    healthFactorBefore: 1.85,
    healthFactorAfter: 1.85,
  });
  const [calculationResult, setCalculationResult] =
    useState<CalculationResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    variant: "processing" | "success" | "error" | "info";
    title?: string;
    description?: string;
  } | null>(null);
  const txStatus = useTxStatus(txHash);

  // Hydrate default interest rates from the live /api/markets endpoint.
  // Falls back silently to the hardcoded values above if the fetch fails.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/markets?asset=XLM", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            markets?: Array<{
              asset: string;
              supplyApr: number;
              borrowApr: number;
            }>;
          } | null,
        ) => {
          if (!data?.markets) return;
          const xlm = data.markets.find((m) => m.asset === "XLM");
          if (!xlm) return;
          setLendingData((prev) => ({ ...prev, interestRate: xlm.supplyApr }));
          setBorrowingData((prev) => ({
            ...prev,
            interestRate: xlm.borrowApr,
          }));
        },
      )
      .catch(() => {
        /* keep hardcoded fallback */
      });
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

  const handleRepaySubmit = (
    data: LendingData,
    quote: CalculationResult | null,
  ) => {
    setRepayData(data);
    setCalculationResult(quote);
    setShowConfirmModal(true);
  };

  const handleWithdrawSubmit = (data: LendingData) => {
    setWithdrawData(data);
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    setShowConfirmModal(false);

    const actionData =
      activeTab === "lend"
        ? lendingData
        : activeTab === "borrow"
          ? borrowingData
          : activeTab === "repay"
            ? repayData
            : withdrawData;

    const payload = {
      signedEnvelopeXdr: JSON.stringify({
        action: activeTab,
        data: actionData,
      }),
    };
    try {
      const res = await fetch("/api/tx/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        const json = await res.json().catch(() => ({}));
        setToast({
          variant: "error",
          title: "Rate limited",
          description:
            json?.error?.message || "Too many requests. Try again later.",
        });
        return;
      }

      const json = await res.json();
      if (res.ok && json?.status === "submitted" && json?.hash) {
        setTxHash(json.hash);
        setToast({
          variant: "processing",
          title: "Transaction submitted",
          description: "Waiting for on-chain settlement...",
        });
      } else {
        setToast({
          variant: "error",
          title: "Submission failed",
          description: json?.error?.message || "Unable to submit transaction",
        });
      }
    } catch (err) {
      setToast({
        variant: "error",
        title: "Submission error",
        description: String(err),
      });
    }
  };

  useEffect(() => {
    if (!txStatus) return;
    if (txStatus.state === "processing") {
      setToast({
        variant: "processing",
        title: "Processing",
        description: "Transaction is being processed on-chain",
      });
    } else if (txStatus.state === "completed") {
      setToast({
        variant: "success",
        title: "Completed",
        description: "Transaction settled on-chain",
      });
      setTimeout(() => setTxHash(null), 2000);
    } else if (txStatus.state === "failed") {
      setToast({
        variant: "error",
        title: "Failed",
        description: "Transaction failed on-chain",
      });
      setTimeout(() => setTxHash(null), 2000);
    } else if (txStatus.state === "rate_limited") {
      setToast({
        variant: "error",
        title: "Rate limited",
        description: `Rate limited by relay. Retry after ${txStatus.retryAfterSeconds || "some"}s`,
      });
    }
  }, [txStatus]);

  const currentData =
    activeTab === "lend"
      ? lendingData
      : activeTab === "borrow"
        ? borrowingData
        : activeTab === "repay"
          ? repayData
          : withdrawData;

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
              description="Earn interest, borrow against collateral, repay open debt positions, or withdraw supplied liquidity."
              className="mb-0"
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
          <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {activeTab === "lend" ? (
              <LendingForm
                onSubmit={handleLendingSubmit}
                initialData={lendingData}
              />
            ) : activeTab === "borrow" ? (
              <BorrowingForm
                onSubmit={handleBorrowingSubmit}
                initialData={borrowingData}
              />
            ) : activeTab === "repay" ? (
              <RepayForm onSubmit={handleRepaySubmit} />
            ) : (
              <WithdrawForm onSubmit={handleWithdrawSubmit} />
            )}
          </div>

          <div className="space-y-6">
            {activeTab === "repay" || activeTab === "withdraw" ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-2 text-lg font-semibold text-gray-900">
                  {activeTab === "repay"
                    ? "Repayment Status"
                    : "Withdrawal Status"}
                </h2>
                <p className="text-sm text-gray-600">
                  {activeTab === "repay"
                    ? "Submit a repayment preview to open the confirmation step and review quote details before signing."
                    : "Submit a withdrawal preview to open the confirmation step before signing."}
                </p>
              </div>
            ) : (
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
        {toast && (
          <Toast
            variant={toast.variant}
            title={toast.title}
            description={toast.description}
          />
        )}
      </div>
    </div>
  );
}
