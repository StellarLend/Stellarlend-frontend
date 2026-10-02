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

const VALID_TABS: readonly LendingActionType[] = [
  "lend",
  "borrow",
  "repay",
  "withdraw",
] as const;

const DRAFT_STORAGE_KEY = "lending-form-draft";

interface MarketItem {
  asset: string;
  supplyApr: number;
  borrowApr: number;
}

type MarketStatus = "loading" | "idle" | "empty" | "forbidden" | "error";

interface MarketState {
  status: MarketStatus;
  markets: MarketItem[];
  errorMessage: string | null;
}

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
  if (!value) return "lend";
  const normalized = value.trim().toLowerCase();
  return (VALID_TABS as readonly string[]).includes(normalized)
    ? (normalized as LendingActionType)
    : "lend";
}

function validateDraftData(data: unknown): data is LendingData {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  if (typeof d.asset !== "string" || d.asset.trim() === "") return false;
  if (typeof d.amount !== "number" || !Number.isFinite(d.amount) || d.amount < 0) return false;
  if (typeof d.interestRate !== "number" || !Number.isFinite(d.interestRate) || d.interestRate < 0) return false;
  return true;
}

export default function LendingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<LendingActionType>(() =>
    parseTab(searchParams.get("tab")),
  );

  const [calculationResult, setCalculationResult] =
    useState<CalculationResult | null>(null);

  const handleTabChange = useCallback(
    (tab: LendingActionType) => {
      setActiveTab(tab);
      setCalculationResult(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Sync tab when the user navigates back/forward
  useEffect(() => {
    const tab = parseTab(searchParams.get("tab"));
    setActiveTab((prev) => {
      if (prev !== tab) {
        setCalculationResult(null);
        return tab;
      }
      return prev;
    });
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

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const isSubmittingRef = useRef(false);
  const submitAbortControllerRef = useRef<AbortController | null>(null);
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

  // Live market rates state
  const [marketState, setMarketState] = useState<MarketState>({
    status: "loading",
    markets: [],
    errorMessage: null,
  });
  const marketReqSeqRef = useRef(0);
  const marketAbortControllerRef = useRef<AbortController | null>(null);

  const fetchMarkets = useCallback(async () => {
    marketAbortControllerRef.current?.abort();
    const controller = new AbortController();
    marketAbortControllerRef.current = controller;
    const seq = ++marketReqSeqRef.current;

    setMarketState((prev) => ({
      ...prev,
      status: "loading",
      errorMessage: null,
    }));

    try {
      const res = await fetch("/api/markets?asset=XLM", { signal: controller.signal });
      if (seq !== marketReqSeqRef.current) return;

      if (res.status === 403) {
        setMarketState({
          status: "forbidden",
          markets: [],
          errorMessage: "Permission denied: You do not have permission to view live market rates.",
        });
        return;
      }

      if (!res.ok) {
        setMarketState({
          status: "error",
          markets: [],
          errorMessage: "Failed to load market rates. Please try again.",
        });
        return;
      }

      const data = await res.json().catch(() => null);
      if (seq !== marketReqSeqRef.current) return;

      const rawMarkets = Array.isArray(data?.markets) ? data.markets : [];
      const markets: MarketItem[] = rawMarkets.filter(
        (m: unknown): m is MarketItem =>
          typeof m === "object" &&
          m !== null &&
          typeof (m as MarketItem).asset === "string" &&
          typeof (m as MarketItem).supplyApr === "number" &&
          Number.isFinite((m as MarketItem).supplyApr) &&
          typeof (m as MarketItem).borrowApr === "number" &&
          Number.isFinite((m as MarketItem).borrowApr),
      );

      if (markets.length === 0) {
        setMarketState({
          status: "empty",
          markets: [],
          errorMessage: null,
        });
        return;
      }

      setMarketState({
        status: "idle",
        markets,
        errorMessage: null,
      });

      const xlm = markets.find((m) => m.asset === "XLM");
      if (xlm) {
        setLendingData((prev) => ({ ...prev, interestRate: xlm.supplyApr }));
        setBorrowingData((prev) => ({
          ...prev,
          interestRate: xlm.borrowApr,
        }));
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      if (seq !== marketReqSeqRef.current) return;

      setMarketState({
        status: "error",
        markets: [],
        errorMessage: "Failed to load market rates. Please try again.",
      });
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    return () => {
      marketAbortControllerRef.current?.abort();
    };
  }, [fetchMarkets]);

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
          (VALID_TABS as readonly string[]).includes(parsed.activeTab) &&
          validateDraftData(parsed.data)
        ) {
          saved = {
            activeTab: parsed.activeTab as LendingActionType,
            data: parsed.data,
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

  const saveDraft = (data: LendingData, tab: LendingActionType) => {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ activeTab: tab, data }),
      );
    } catch {
      // Persistence is best-effort; the flow remains usable without it.
    }
  };

  const discardDraft = useCallback(() => {
    setDraft(null);
    clearStoredDraft();
  }, []);

  const resumeDraft = useCallback(() => {
    if (!draft) return;
    const targetTab = draft.activeTab;
    const targetData = draft.data;

    discardDraft();
    handleTabChange(targetTab);
    if (targetTab === "lend") {
      setLendingData(targetData);
    } else if (targetTab === "borrow") {
      setBorrowingData(targetData);
    } else if (targetTab === "repay") {
      setRepayData(targetData);
    } else {
      setWithdrawData(targetData);
    }

    setCalculationResult(null);
  }, [draft, discardDraft, handleTabChange]);

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

  useEffect(() => {
    return () => {
      submitAbortControllerRef.current?.abort();
    };
  }, []);

  const handleConfirm = async () => {
    if (isSubmittingRef.current) return;

    const actionData =
      activeTab === "lend"
        ? lendingData
        : activeTab === "borrow"
          ? borrowingData
          : activeTab === "repay"
            ? repayData
            : withdrawData;

    // Boundary and validation invariants
    if (
      typeof actionData.amount !== "number" ||
      !Number.isFinite(actionData.amount) ||
      actionData.amount <= 0
    ) {
      setToast({
        variant: "error",
        title: "Validation error",
        description: "Please enter a valid amount greater than 0.",
      });
      return;
    }

    if (
      !actionData.asset ||
      typeof actionData.asset !== "string" ||
      actionData.asset.trim() === ""
    ) {
      setToast({
        variant: "error",
        title: "Validation error",
        description: "Asset is required.",
      });
      return;
    }

    if (
      (activeTab === "repay" || activeTab === "withdraw") &&
      (!actionData.positionId || actionData.positionId.trim() === "")
    ) {
      setToast({
        variant: "error",
        title: "Validation error",
        description: "A valid position is required for this action.",
      });
      return;
    }

    isSubmittingRef.current = true;
    setShowConfirmModal(false);
    setTxHash(null);
    setTxProgressState("building");

    submitAbortControllerRef.current?.abort();
    const controller = new AbortController();
    submitAbortControllerRef.current = controller;

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
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);

      if (res.status === 429) {
        setTxProgressState("failed");
        const msg =
          (typeof json?.error === "string" ? json.error : json?.error?.message) ||
          "Too many requests. Try again later.";
        setToast({
          variant: "error",
          title: "Rate limited",
          description: msg,
        });
        return;
      }

      if (res.status === 401 || res.status === 403) {
        setTxProgressState("failed");
        const msg =
          (typeof json?.error === "string" ? json.error : json?.error?.message) ||
          "Authorization error. Please check your credentials.";
        setToast({
          variant: "error",
          title: "Authorization error",
          description: msg,
        });
        return;
      }

      if (res.ok && json?.status === "submitted" && typeof json?.hash === "string" && json.hash) {
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
        const msg =
          (typeof json?.error === "string" ? json.error : json?.error?.message) ||
          "Unable to submit transaction";
        setToast({
          variant: "error",
          title: "Submission failed",
          description: msg,
        });
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setTxProgressState("failed");
      setToast({
        variant: "error",
        title: "Submission error",
        description: "A network error occurred while submitting the transaction.",
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
              description="Earn interest by lending your assets or borrow against your collateral."
              className="mb-0"
            />
            <div className="mt-4">
              <PriceTicker />
            </div>
          </div>
        </section>

        {/* Live Market Rates Section */}
        <section
          aria-label="Live Market Rates"
          className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur"
        >
          {marketState.status === "loading" && (
            <div className="flex items-center space-x-2 text-sm text-slate-500" role="status">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <span>Loading live market rates...</span>
            </div>
          )}

          {marketState.status === "forbidden" && (
            <div
              role="alert"
              className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm text-amber-900 border border-amber-200"
            >
              <span>Permission denied: You do not have permission to view live market rates.</span>
            </div>
          )}

          {marketState.status === "error" && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 border border-red-200"
            >
              <span>{marketState.errorMessage || "Failed to load market rates."}</span>
              <button
                type="button"
                onClick={fetchMarkets}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {marketState.status === "empty" && (
            <div className="text-center py-2 text-sm text-slate-500">
              No markets available at this time.
            </div>
          )}

          {marketState.status === "idle" && marketState.markets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {marketState.markets.map((m) => (
                <div
                  key={m.asset}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-2.5 text-sm"
                >
                  <span className="font-semibold text-slate-900">{m.asset}</span>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-emerald-700 font-medium">
                      Supply: {m.supplyApr.toFixed(1)}%
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-blue-700 font-medium">
                      Borrow: {m.borrowApr.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
