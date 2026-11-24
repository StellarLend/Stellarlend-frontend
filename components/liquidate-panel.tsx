"use client";

import React, { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { isValidGAddress } from "@/lib/api/address";
import {
  fromBaseUnits,
  toBaseUnits,
} from "@/lib/amount";
import { decodeContractError } from "@/lib/errors/decode";
import {
  getBorrowerPosition,
  getLiquidationParams,
  isPositionLiquidatable,
  previewLiquidation,
  type BorrowerPosition,
  type LiquidationParams,
  type LiquidationPreview,
} from "@/lib/liquidation";
import { executeLiquidation } from "@/lib/tx";
import { txExplorer } from "@/lib/config";
import { queryKeys } from "@/lib/query-keys";
import { useWallet } from "@/components/wallet";

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

function fmt(raw: bigint): string {
  return fromBaseUnits(raw);
}

function bpsToPercent(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(2)} %`;
}

function healthLabel(hf: bigint): string {
  // Contract uses 10 000 as 1.0 scale
  return (Number(hf) / 10_000).toFixed(4);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PositionRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-[var(--line)] last:border-0">
      <span className="mut">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function LiquidatePanel() {
  const t = useTranslations("liquidate");
  const { address: walletAddress, signTransaction } = useWallet();

  const [borrowerInput, setBorrowerInput] = useState("");
  const [submittedBorrower, setSubmittedBorrower] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  const [repayInput, setRepayInput] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ----- Position query -----
  const positionQuery = useQuery<BorrowerPosition, Error>({
    queryKey: queryKeys.position(submittedBorrower ?? ""),
    queryFn: () => getBorrowerPosition(submittedBorrower!),
    enabled: submittedBorrower !== null,
    retry: false,
  });

  // ----- Liquidation params query -----
  const paramsQuery = useQuery<LiquidationParams, Error>({
    queryKey: queryKeys.liquidationParams(),
    queryFn: getLiquidationParams,
    staleTime: 30_000,
  });

  // Derived data
  const position = positionQuery.data ?? null;
  const params = paramsQuery.data ?? null;

  const liquidatabilityCheck =
    position && params
      ? isPositionLiquidatable(position, params)
      : null;

  const maxRepay: bigint | null =
    position && params
      ? (position.debtAmount * params.closeFactorBps) / 10_000n
      : null;

  const preview: LiquidationPreview | null = (() => {
    if (!position || !params) return null;
    const parsed = toBaseUnits(repayInput);
    if (!parsed.ok) return null;
    return previewLiquidation({
      debt: position.debtAmount,
      collateral: position.collateralAmount,
      closeFactorBps: params.closeFactorBps,
      incentiveBps: params.liquidationIncentiveBps,
      amount: parsed.value,
    });
  })();

  // ----- Handlers -----

  const handleLookup = useCallback(() => {
    setAddressError(null);
    setSubmittedBorrower(null);
    setRepayInput("");
    setAmountError(null);
    setTxHash(null);
    setSubmitError(null);

    if (!isValidGAddress(borrowerInput.trim())) {
      setAddressError(t("invalidAddress"));
      return;
    }
    setSubmittedBorrower(borrowerInput.trim());
  }, [borrowerInput, t]);

  const handleRepayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRepayInput(e.target.value);
      setAmountError(null);

      if (e.target.value === "") return;

      const parsed = toBaseUnits(e.target.value);
      if (!parsed.ok) {
        setAmountError(t("repayPlaceholder"));
        return;
      }
      if (maxRepay !== null && parsed.value > maxRepay) {
        setAmountError(t("amountTooLarge"));
      }
    },
    [maxRepay, t],
  );

  const handleMaxRepay = useCallback(() => {
    if (maxRepay === null) return;
    setRepayInput(fromBaseUnits(maxRepay));
    setAmountError(null);
  }, [maxRepay]);

  const handleSubmit = useCallback(async () => {
    if (!walletAddress || !submittedBorrower || !params || !position) return;

    const parsed = toBaseUnits(repayInput);
    if (!parsed.ok) {
      setAmountError(t("repayPlaceholder"));
      return;
    }
    if (maxRepay !== null && parsed.value > maxRepay) {
      setAmountError(t("amountTooLarge"));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setTxHash(null);

    try {
      const result = await executeLiquidation({
        liquidator: walletAddress,
        borrower: submittedBorrower,
        // Debt / collateral asset addresses fall back to empty string; the
        // contract uses them to identify assets — callers with a configured
        // market should supply the correct contract IDs. Kept as a minimal
        // working default for the UI scaffold.
        debtAsset: "",
        collateralAsset: "",
        amount: parsed.value,
        contractId: "",
      });
      setTxHash(result.hash);
    } catch (err) {
      const decoded = decodeContractError(err);
      setSubmitError(decoded.message);
    } finally {
      setSubmitting(false);
    }
  }, [
    walletAddress,
    submittedBorrower,
    params,
    position,
    repayInput,
    maxRepay,
    t,
  ]);

  // ----- Derived submit guard -----
  const canSubmit =
    !!walletAddress &&
    !!submittedBorrower &&
    liquidatabilityCheck?.liquidatable === true &&
    repayInput !== "" &&
    amountError === null &&
    !submitting;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm mut">{t("subtitle")}</p>
      </div>

      {/* Borrower lookup */}
      <section className="rounded-xl border border-[var(--line)] p-4 space-y-3">
        <label className="block text-sm font-medium" htmlFor="borrower-input">
          {t("borrowerLabel")}
        </label>
        <div className="flex gap-2">
          <input
            id="borrower-input"
            type="text"
            value={borrowerInput}
            onChange={(e) => {
              setBorrowerInput(e.target.value);
              setAddressError(null);
            }}
            placeholder={t("borrowerPlaceholder")}
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
            aria-describedby={addressError ? "borrower-error" : undefined}
            aria-invalid={addressError ? "true" : undefined}
          />
          <button
            onClick={handleLookup}
            disabled={positionQuery.isFetching}
            className="rounded-lg bg-[var(--acc)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {positionQuery.isFetching ? t("lookingUp") : t("lookupButton")}
          </button>
        </div>
        {addressError && (
          <p id="borrower-error" role="alert" className="text-sm text-red-500">
            {addressError}
          </p>
        )}
        {positionQuery.isError && (
          <p role="alert" className="text-sm text-red-500">
            {t("lookupError")}: {positionQuery.error.message}
          </p>
        )}
      </section>

      {/* Position details */}
      {position && params && (
        <section
          className="rounded-xl border border-[var(--line)] p-4 space-y-2"
          aria-label={t("positionHeading")}
        >
          <h2 className="text-sm font-semibold mb-3">{t("positionHeading")}</h2>
          <PositionRow label={t("collateral")} value={fmt(position.collateralAmount)} />
          <PositionRow label={t("debt")} value={fmt(position.debtAmount)} />
          <PositionRow label={t("healthFactor")} value={healthLabel(position.healthFactor)} />
          <PositionRow label={t("closeFactor")} value={bpsToPercent(params.closeFactorBps)} />
          <PositionRow label={t("incentive")} value={bpsToPercent(params.liquidationIncentiveBps)} />

          {liquidatabilityCheck && !liquidatabilityCheck.liquidatable && (
            <p role="status" className="mt-2 rounded-lg bg-green-900/30 border border-green-700/40 px-3 py-2 text-sm text-green-400">
              {t("notLiquidatable")}
            </p>
          )}
        </section>
      )}

      {/* Repay input + preview */}
      {position && params && liquidatabilityCheck?.liquidatable && (
        <section className="rounded-xl border border-[var(--line)] p-4 space-y-3">
          <label className="block text-sm font-medium" htmlFor="repay-input">
            {t("repayLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id="repay-input"
              type="text"
              value={repayInput}
              onChange={handleRepayChange}
              placeholder={t("repayPlaceholder")}
              className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--acc)]"
              aria-describedby={amountError ? "repay-error" : undefined}
              aria-invalid={amountError ? "true" : undefined}
            />
            <button
              type="button"
              onClick={handleMaxRepay}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium hover:bg-[var(--line)/20]"
            >
              {t("maxRepay")}
            </button>
          </div>
          {amountError && (
            <p id="repay-error" role="alert" className="text-sm text-red-500">
              {amountError}
            </p>
          )}

          {/* Inline preview */}
          {preview && repayInput !== "" && !amountError && (
            <div className="mt-2 rounded-lg bg-[var(--line)/10] p-3 space-y-1 text-sm">
              <p className="font-medium text-xs mut uppercase tracking-wide mb-2">{t("preview")}</p>
              <div className="flex justify-between">
                <span className="mut">{t("actualRepay")}</span>
                <span className="font-mono">{fmt(preview.actualRepay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="mut">{t("seizedEstimate")}</span>
                <span className="font-mono">{fmt(preview.seizedEstimate)}</span>
              </div>
            </div>
          )}

          {/* Submit */}
          {!walletAddress ? (
            <p className="text-sm mut text-center py-2">{t("connectWallet")}</p>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full rounded-lg bg-[var(--acc)] py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? t("submitting") : t("submitButton")}
            </button>
          )}
        </section>
      )}

      {/* Success */}
      {txHash && (
        <section
          role="status"
          className="rounded-xl border border-green-700/40 bg-green-900/20 p-4 space-y-2"
        >
          <p className="font-semibold text-green-400">{t("txSuccessHeading")}</p>
          <a
            href={txExplorer(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline text-[var(--acc)]"
            data-testid="explorer-link"
          >
            {t("viewOnExplorer")}
          </a>
        </section>
      )}

      {/* Submit error */}
      {submitError && (
        <section role="alert" className="rounded-xl border border-red-700/40 bg-red-900/20 p-4">
          <p className="font-semibold text-red-400">{t("errorHeading")}</p>
          <p className="mt-1 text-sm mut">{submitError}</p>
        </section>
      )}
    </div>
  );
}
