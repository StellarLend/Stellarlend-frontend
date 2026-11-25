"use client";
/**
 * useTradeSubmit
 *
 * Encapsulates the submit logic for supply/borrow/withdraw/repay actions.
 * Handles both on-chain (via submitLendingAction) and demo-ledger paths.
 * Returns a stable `submit` function and the current tx state.
 */

import { useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { normaliseAmountInput } from "@/lib/amount-input";
import { toBaseUnits, type AmountError } from "@/lib/amount";
import { isOnChainConfigured, submitLendingAction, type LendingTx } from "@/lib/lending-client";
import { canWithdraw, canBorrow, toFloat, type Ledger } from "@/lib/demo-ledger";
import { formatNumber } from "@/lib/markets";
import { type Market, type Locale } from "@/lib/markets";
import { type TradeOracleGuard } from "@/hooks/use-oracle-guard";
import { type UsePendingTxsReturn } from "@/hooks/use-pending-txs";

export type TradeModeType = "supply" | "borrow" | "withdraw" | "repay";

export type UseTradeSubmitOptions = {
  sel: Market | null;
  mode: TradeModeType;
  amt: string;
  ledger: Ledger;
  activeMarkets: Market[];
  address: string | null | undefined;
  missingTrustline: boolean;
  oracleGuard: TradeOracleGuard;
  pendingTxs: UsePendingTxsReturn;
  addToast: (args: { id?: string; action: string; symbol: string; tx: LendingTx }) => string;
  onConfirmed: () => void;
  onLedgerUpdate: (next: Ledger) => void;
  onAmtClear: () => void;
};

export type UseTradeSubmitResult = {
  tx: LendingTx | null;
  msg: { text: string; isError: boolean } | null;
  busy: boolean;
  setMsg: (msg: { text: string; isError: boolean } | null) => void;
  setTx: (tx: LendingTx | null) => void;
  submit: () => Promise<void>;
};

export function useTradeSubmit({
  sel,
  mode,
  amt,
  ledger,
  activeMarkets,
  address,
  missingTrustline,
  oracleGuard,
  pendingTxs,
  addToast,
  onConfirmed,
  onLedgerUpdate,
  onAmtClear,
}: UseTradeSubmitOptions): UseTradeSubmitResult {
  const locale = useLocale() as Locale;
  const t = useTranslations("market");
  const configured = isOnChainConfigured();
  const onChainMode = Boolean(address && configured);

  const [tx, setTx] = useState<LendingTx | null>(null);
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const busy = tx?.status === "pending";

  function inputErrorText(error: AmountError, decimals: number): string {
    const msgs: Record<string, string> = {
      empty: t("status.positiveAmount"),
      "invalid-format": t("status.invalidFormat"),
      negative: t("status.negative"),
      "too-many-decimals": t("status.tooManyDecimals", { decimals }),
      "too-large": t("status.tooLarge"),
    };
    return msgs[error] ?? t("status.invalidFormat");
  }

  const submit = useCallback(async () => {
    if (!sel || busy || oracleGuard.blocked) return;
    const trustlineBlocksAction = missingTrustline && (mode === "supply" || mode === "repay");
    if (trustlineBlocksAction) return;

    const normalized = normaliseAmountInput(amt, locale);
    const parsed = toBaseUnits(normalized ?? amt.trim(), sel.decimals);
    if (!parsed.ok) {
      setMsg({ text: inputErrorText(parsed.error, sel.decimals), isError: true });
      return;
    }
    const n = parsed.value;
    if (n <= BigInt(0)) {
      setMsg({ text: t("status.positiveAmount"), isError: true });
      return;
    }

    // ── On-chain path ────────────────────────────────────────────────────
    if (onChainMode && sel.live && address) {
      setMsg(null);
      const action = mode === "supply" ? "deposit" : mode;

      if (pendingTxs.isDuplicate(action, sel.symbol)) {
        setMsg({ text: t("status.duplicatePending"), isError: true });
        return;
      }

      const toastId = addToast({
        action,
        symbol: sel.symbol,
        tx: { status: "pending", hash: null, error: null },
      });
      setTx({ status: "pending", hash: null, error: null });

      const result = await submitLendingAction(address, action, n, (updatedTx) => {
        setTx(updatedTx);
        addToast({ id: toastId, action, symbol: sel.symbol, tx: updatedTx });
        if (updatedTx.hash && updatedTx.status === "pending") {
          pendingTxs.record({
            hash: updatedTx.hash,
            action,
            asset: sel.symbol,
            amount: n.toString(),
            submittedAt: Date.now(),
            status: "pending",
          });
        }
      });
      if (result.status === "confirmed") {
        onAmtClear();
        onConfirmed();
      }
      return;
    }

    // ── Demo ledger path ─────────────────────────────────────────────────
    const rawCur = ledger && typeof ledger === "object" ? ledger[sel.symbol] : undefined;
    const cur =
      rawCur && typeof rawCur.supplied === "bigint" && typeof rawCur.borrowed === "bigint"
        ? rawCur
        : { supplied: BigInt(0), borrowed: BigInt(0) };
    const next = { ...cur };

    if (mode === "supply") {
      if (
        sel.depositCapRemaining !== null &&
        sel.depositCapRemaining !== undefined &&
        n > sel.depositCapRemaining
      ) {
        setMsg({ text: t("status.depositCapExceeded"), isError: true });
        return;
      }
      next.supplied = cur.supplied + n;
    } else if (mode === "withdraw") {
      if (n > cur.supplied) { setMsg({ text: t("status.exceedsSupply"), isError: true }); return; }
      if (!canWithdraw(ledger, sel.symbol, n, activeMarkets)) {
        setMsg({ text: t("status.underCollateralised"), isError: true });
        return;
      }
      next.supplied = cur.supplied - n;
    } else if (mode === "borrow") {
      if (sel.minBorrow !== null && sel.minBorrow !== undefined && n < sel.minBorrow) {
        setMsg({ text: t("status.belowMinimumBorrow"), isError: true });
        return;
      }
      if (!canBorrow(ledger, sel.symbol, n, activeMarkets)) {
        setMsg({ text: t("status.exceedsBorrowLimit"), isError: true });
        return;
      }
      next.borrowed = cur.borrowed + n;
    } else if (mode === "repay") {
      if (n > cur.borrowed) { setMsg({ text: t("status.exceedsBorrowed"), isError: true }); return; }
      next.borrowed = cur.borrowed - n;
    }

    onLedgerUpdate({ ...ledger, [sel.symbol]: next });
    setMsg({
      text: t("status.recorded", {
        action: t(mode),
        amount: formatNumber(toFloat(n, sel.decimals), locale, sel.decimals),
        symbol: sel.symbol,
      }),
      isError: false,
    });
    onAmtClear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, busy, oracleGuard.blocked, missingTrustline, mode, amt, locale, onChainMode, address, ledger, activeMarkets, pendingTxs, addToast, onConfirmed, onLedgerUpdate, onAmtClear, t]);

  return { tx, msg, busy, setMsg, setTx, submit };
}
