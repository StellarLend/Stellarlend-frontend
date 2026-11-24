"use client";
/**
 * Transaction toast / status centre.
 *
 * Provides:
 *  - `TxToastsProvider`  – wrap the app once; holds the useReducer store.
 *  - `useTxToasts`       – add / dismiss toasts from anywhere.
 *  - `TxToastRegion`     – renders the visible stack + aria-live region.
 *
 * Rules:
 *  - Confirmed toasts auto-dismiss after AUTO_DISMISS_MS (6 s).
 *  - Failed / timeout toasts persist until the user dismisses them.
 *  - Cancelled toasts auto-dismiss after CANCEL_DISMISS_MS (3 s).
 *  - Max MAX_VISIBLE toasts are shown; older confirmed/cancelled ones are
 *    silently dropped when the cap is reached.
 *  - prefers-reduced-motion: transitions are skipped via CSS.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { useTranslations } from "next-intl";
import { txExplorer } from "@/lib/config";
import type { LendingAction, LendingTx, LendingTxStatus } from "@/lib/lending-client";

// ─── constants ────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 6_000;
const CANCEL_DISMISS_MS = 3_000;
const MAX_VISIBLE = 4;

// ─── types ────────────────────────────────────────────────────────────────────

export type TxToastEntry = {
  /** Stable key for React reconciliation and dismiss targeting. */
  id: string;
  action: LendingAction;
  symbol: string;
  tx: LendingTx;
};

type State = { toasts: TxToastEntry[] };

type Action =
  | { type: "UPSERT"; entry: TxToastEntry }
  | { type: "DISMISS"; id: string };

// ─── reducer ──────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "UPSERT": {
      const idx = state.toasts.findIndex((t) => t.id === action.entry.id);
      let next: TxToastEntry[];
      if (idx >= 0) {
        // Update in-place to keep order stable.
        next = state.toasts.map((t, i) => (i === idx ? action.entry : t));
      } else {
        next = [action.entry, ...state.toasts];
      }
      // Enforce max-visible cap: drop excess confirmed/cancelled entries.
      if (next.length > MAX_VISIBLE) {
        let excess = next.length - MAX_VISIBLE;
        next = next.filter((t) => {
          if (excess > 0 && (t.tx.status === "confirmed" || t.tx.status === "cancelled")) {
            excess--;
            return false;
          }
          return true;
        });
        // Hard cap if we still exceed (all are failed/timeout).
        if (next.length > MAX_VISIBLE) {
          next = next.slice(0, MAX_VISIBLE);
        }
      }
      return { toasts: next };
    }
    case "DISMISS":
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

// ─── context ──────────────────────────────────────────────────────────────────

type Ctx = {
  toasts: TxToastEntry[];
  /**
   * Add or update a toast. Returns `id` so callers can track a single
   * transaction through its lifecycle by calling addToast repeatedly with the
   * same id.
   */
  addToast: (params: {
    id?: string;
    action: LendingAction;
    symbol: string;
    tx: LendingTx;
  }) => string;
  dismiss: (id: string) => void;
};

const TxToastsCtx = createContext<Ctx | null>(null);

// ─── provider ─────────────────────────────────────────────────────────────────

export function TxToastsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { toasts: [] });
  const counterRef = useRef(0);

  const addToast = useCallback(
    ({
      id,
      action,
      symbol,
      tx,
    }: {
      id?: string;
      action: LendingAction;
      symbol: string;
      tx: LendingTx;
    }): string => {
      const resolvedId = id ?? `tx-${++counterRef.current}-${Date.now()}`;
      dispatch({ type: "UPSERT", entry: { id: resolvedId, action, symbol, tx } });
      return resolvedId;
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "DISMISS", id });
  }, []);

  return (
    <TxToastsCtx.Provider value={{ toasts: state.toasts, addToast, dismiss }}>
      {children}
    </TxToastsCtx.Provider>
  );
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useTxToasts(): Ctx {
  const ctx = useContext(TxToastsCtx);
  if (!ctx) throw new Error("useTxToasts must be used inside TxToastsProvider");
  return ctx;
}

// ─── individual toast ─────────────────────────────────────────────────────────

function TxToast({
  entry,
  onDismiss,
}: {
  entry: TxToastEntry;
  onDismiss: () => void;
}) {
  const t = useTranslations("txToasts");
  const { tx, action, symbol, id } = entry;
  const status: LendingTxStatus = tx.status;

  // Auto-dismiss for confirmed and cancelled.
  useEffect(() => {
    if (status === "confirmed") {
      const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }
    if (status === "cancelled") {
      const timer = setTimeout(onDismiss, CANCEL_DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  const isPending = status === "pending";
  const isConfirmed = status === "confirmed";
  const isFailed = status === "failed";
  const isTimeout = status === "timeout";
  const isCancelled = status === "cancelled";

  // Localized message per status.
  let message: string;
  if (isPending) {
    message = t("pending", { action: t(`action.${action}`), symbol });
  } else if (isConfirmed) {
    message = t("confirmed", { action: t(`action.${action}`), symbol });
  } else if (isCancelled) {
    message = t("cancelled", { action: t(`action.${action}`), symbol });
  } else if (isTimeout) {
    message = t("timeout", { action: t(`action.${action}`), symbol });
  } else {
    // failed
    const errorMsg = tx.error?.message ?? t("unknownError");
    const hint = tx.error?.hint;
    message = hint ? `${errorMsg} ${hint}` : errorMsg;
  }

  const colourClass = isConfirmed
    ? "border-emerald-700/60 bg-emerald-950/60"
    : isFailed || isTimeout
      ? "border-red-700/60 bg-red-950/60"
      : isCancelled
        ? "border-zinc-700/60 bg-zinc-900/80"
        : "border-zinc-700/60 bg-zinc-900/80"; // pending

  const textClass = isConfirmed
    ? "text-emerald-300"
    : isFailed || isTimeout
      ? "text-red-300"
      : "text-zinc-200";

  const labelId = `toast-label-${id}`;

  return (
    <div
      role="status"
      aria-labelledby={labelId}
      className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-all motion-reduce:transition-none ${colourClass}`}
    >
      {/* Status icon */}
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-base">
        {isPending && "⏳"}
        {isConfirmed && "✅"}
        {isFailed && "❌"}
        {isTimeout && "⌛"}
        {isCancelled && "🚫"}
      </span>

      <div className="min-w-0 flex-1">
        <p id={labelId} className={`text-sm font-medium ${textClass}`}>
          {message}
        </p>
        {tx.hash && (
          <a
            href={txExplorer(tx.hash)}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block truncate text-xs underline opacity-70 hover:opacity-100"
          >
            {t("viewTx")}
          </a>
        )}
      </div>

      {/* Dismiss button — always shown; required for persistent failed/timeout toasts. */}
      <button
        onClick={onDismiss}
        aria-label={t("dismiss")}
        className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}

// ─── region (mount once near root) ───────────────────────────────────────────

/**
 * Renders the stacked toast list inside an `aria-live="polite"` region.
 * Mount this once, ideally just inside the layout's main wrapper.
 */
export function TxToastRegion() {
  const { toasts, dismiss } = useTxToasts();

  return (
    <div
      role="region"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Transaction notifications"
      aria-relevant="additions removals"
      className="pointer-events-none fixed bottom-5 right-4 z-50 flex w-80 flex-col gap-2 sm:right-6"
    >
      {toasts.map((entry) => (
        <div key={entry.id} className="pointer-events-auto">
          <TxToast entry={entry} onDismiss={() => dismiss(entry.id)} />
        </div>
      ))}
    </div>
  );
}
