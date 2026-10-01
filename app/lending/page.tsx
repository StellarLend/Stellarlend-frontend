"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import useTxStatus from "@/lib/tx/useTxStatus";
import { PriceTicker, Toast } from "@/components/shared/common";
import LendingForm from "@/components/features/lending/components/LendingForm";
import { usePositions } from "@/hooks/usePositions";
import TabSelector from "@/components/features/lending/components/TabSelector";
import TxProgressStepper, {
  type TxProgressState,
} from "@/components/features/lending/components/TxProgressStepper";
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

const VALID_TABS: LendingActionType[] = ["lend", "borrow", "repay", "withdraw"];

const DRAFT_STORAGE_KEY = "lending-form-draft";

type DraftState = {
  activeTab: LendingActionType;
  data: LendingData;
};

function clearStoredDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function parseTab(value: string | null): LendingActionType {
  return VALID_TABS.includes(value as LendingActionType)
    ? (value as LendingActionType)
    : "lend";
}

export default function LendingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<LendingActionType>(() =>
    parseTab(searchParams.get("tab")),
  );

  const handleTabChange = useCallback(
    (tab: LendingActionType) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Sync tab when the user navigates back/forward
  useEffect(() => {
    const tab = parseTab(searchParams.get("tab"));
    setActiveTab(tab);
  }, [searchParams]);
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
  const [draft, setDraft] = useState<DraftState | null>(null);
  const isSubmittingRef = useRef(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txProgressState, setTxProgressState] =
    useState<TxProgressState | null>(null);
  const {
    supplyPositions,
    isLoading: isPositionsLoading,
    error: positionsError,
  } = usePositions();
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

  // Restore a previously saved draft once on mount.
  useEffect(() => {
    let saved: DraftState | null = null;

    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          activeTab?: unknown;
          data?: unknown;
        };
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed.activeTab === "string" &&
          VALID_TABS.includes(parsed.activeTab as LendingActionType) &&
          parsed.data &&
          typeof parsed.data === "object" &&
          typeof (parsed.data as { asset?: unknown }).asset === "string" &&
          typeof (parsed.data as { amount?: unknown }).amount === "number"
        ) {
          saved = {
            activeTab: parsed.activeTab as LendingActionType,
            data: parsed.data as LendingData,
          };
        }
      }
    } catch {
      // Ignore malformed or inaccessible storage.
    }

    if (saved) {
      setDraft(saved);
    } else {
      clearStoredDraft();
    }
  }, []);

  const saveDraft = (data: LendingData, activeTab: LendingActionType) => {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ activeTab, data }),
      );
    } catch {
      // Persistence is best-effort; the flow remains usable without it.
    }
  };

  const discardDraft = () => {
    setDraft(null);
    clearStoredDraft();
  };

  const resumeDraft = () => {
    if (!draft) return;

    handleTabChange(draft.activeTab);
    if (draft.activeTab === "lend") {
      setLendingData(draft.data);
    } else if (draft.activeTab === "borrow") {
      setBorrowingData(draft.data);
    } else if (draft.activeTab === "repay") {
      setRepayData(draft.data);
    } else {
      setWithdrawData(draft.data);
    }

    setCalculationResult(null);
    setDraft(null);
  };

  const handleLendingSubmit = (data: LendingData) => {
    setLendingData(data);
    saveDraft(data, "lend");
    setShowConfirmModal(true);
  };

  const handleBorrowingSubmit = (data: LendingData) => {
    setBorrowingData(data);
    saveDraft(data, "borrow");
    setShowConfirmModal(true);
  };

  const handleRepaySubmit = (
    data: LendingData,
    quote: CalculationResult | null,
  ) => {
    setRepayData(data);
    setCalculationResult(quote);
    saveDraft(data, "repay");
    setShowConfirmModal(true);
  };

  const handleWithdrawSubmit = (data: LendingData) => {
    setWithdrawData(data);
    saveDraft(data, "withdraw");
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setShowConfirmModal(false);
    setTxHash(null);
    setTxProgressState("building");

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
        setTxProgressState("failed");
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
        discardDraft();
        setTxHash(json.hash);
        setTxProgressState("submitted");
        setToast({
          variant: "processing",
          title: "Transaction submitted",
          description: "Waiting for on-chain settlement...",
        });
      } else {
        setTxProgressState("failed");
        setToast({
          variant: "error",
          title: "Submission failed",
          description: json?.error?.message || "Unable to submit transaction",
        });
      }
    } catch (err) {
      setTxProgressState("failed");
      setToast({
        variant: "error",
        title: "Submission error",
        description: String(err),
      });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  useEffect(() => {
    if (!txStatus) return;
    if (txStatus.state === "processing") {
      setTxProgressState("pending");
      setToast({
        variant: "processing",
        title: "Processing",
        description: "Transaction is being processed on-chain",
      });
    } else if (txStatus.state === "completed") {
      setTxProgressState("confirmed");
      setToast({
        variant: "success",
        title: "Completed",
        description: "Transaction settled on-chain",
      });
    } else if (txStatus.state === "failed") {
      setTxProgressState("failed");
      setToast({
        variant: "error",
        title: "Failed",
        description: "Transaction failed on-chain",
      });
    } else if (txStatus.state === "rate_limited") {
      setTxProgressState("failed");
      setToast({
        variant: "error",
        title: "Rate limited",
        description: `Rate limited by relay. Retry after ${txStatus.retryAfterSeconds || "some"}s`,
      });
    }
  }, [txStatus]);

  useEffect(() => {
    if (txProgressState !== "confirmed" && txProgressState !== "failed") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setTxHash(null);
      setTxProgressState(null);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [txProgressState]);

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
        {draft && (
          <div
            role="region"
            aria-labelledby="resume-draft-title"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") discardDraft();
            }}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <h2 id="resume-draft-title" className="text-sm font-semibold text-amber-900">
              Resume saved draft
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              You have a saved {draft.activeTab} draft. Resume where you left off or discard it.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                autoFocus
                onClick={resumeDraft}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Discard
              </button>
            </div>
          </div>
        )}
        <section className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-green-600 via-emerald-500 to-black" />
          <div className="p-6 sm:p-8">
            <PageHeader
              tone="light"
              title="Lending & Borrowing"
              description="Earn interest, borrow against collateral, repay open debt positions, or withdraw supplied liquidity."
              className="mb-0"
            />
            <div className="mt-4">
              <PriceTicker />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
          <TabSelector activeTab={activeTab} onTabChange={handleTabChange} />
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
              <WithdrawForm
                onSubmit={handleWithdrawSubmit}
                positions={supplyPositions}
                isLoading={isPositionsLoading}
                error={positionsError}
              />
            )}
            {txProgressState && (
              <div className="mt-4">
                <TxProgressStepper state={txProgressState} />
              </div>
            )}
          </div>

          <div className="space-y-6">
            {activeTab === "repay" || activeTab === "withdraw" ? (
              <TransactionSummary
                data={activeTab === "repay" ? repayData : withdrawData}
                calculation={activeTab === "repay" ? calculationResult : null}
                type={activeTab}
              />
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
          type={activeTab === "repay" ? "borrow" : activeTab}
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
