"use client";

import { useState, useEffect } from "react";
import { LendingData } from "@/app/lending/page";
import Button from "@/components/shared/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ASSETS } from "@/lib/assets";
import AssetSelector from "@/components/shared/ui/AssetSelector";
import { AmountInput } from "@/components/shared/ui/AmountInput";
import {
  FALLBACK_PRICES,
  calculateProjectedBorrowHealth,
  getHealthBand,
  type PriceMap,
} from "@/lib/lending/health";

interface BorrowingFormProps {
  onSubmit: (data: LendingData) => void;
  initialData: LendingData;
}

const INTEREST_RATES = {
  XLM: 12.0,
  USDC: 10.5,
  BTC: 8.0,
  ETH: 9.5,
};

const LOAN_DURATIONS = [
  { days: 7, label: "1 Week" },
  { days: 14, label: "2 Weeks" },
  { days: 30, label: "1 Month" },
  { days: 60, label: "2 Months" },
  { days: 90, label: "3 Months" },
  { days: 180, label: "6 Months" },
];

const HEALTH_BAND_STYLES = {
  healthy: {
    label: "Healthy",
    text: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    helper: "Projected collateral buffer is comfortably above the liquidation threshold.",
  },
  "at-risk": {
    label: "At Risk",
    text: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
    helper: "Projected position is close to the liquidation threshold. Consider adding collateral.",
  },
  critical: {
    label: "Critical",
    text: "text-red-700",
    border: "border-red-200",
    bg: "bg-red-50",
    helper: "Projected position is immediately vulnerable. Add collateral before submitting.",
  },
} as const;

export default function BorrowingForm({
  onSubmit,
  initialData,
}: BorrowingFormProps) {
  const [formData, setFormData] = useState<LendingData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [priceMap, setPriceMap] = useState<PriceMap>(FALLBACK_PRICES);
  const [usingFallbackPrices, setUsingFallbackPrices] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  const selectedAsset = ASSETS.find((a) => a.symbol === formData.asset);
  const collateralAsset = ASSETS.find((a) => a.symbol === formData.collateral);
  const interestRate =
    INTEREST_RATES[formData.asset as keyof typeof INTEREST_RATES];

  // Calculate required collateral (150% of loan amount)
  const requiredCollateral = formData.amount * 1.5;
  const collateralAmount = formData.collateralAmount ?? 0;
  const projectedHealth = calculateProjectedBorrowHealth({
    loanAmount: formData.amount,
    borrowAsset: formData.asset,
    collateralAmount: collateralAmount || requiredCollateral,
    collateralAsset: formData.collateral ?? "",
    prices: priceMap,
  });
  const projectedBand = projectedHealth
    ? getHealthBand(projectedHealth.healthFactor)
    : null;
  const projectedBandStyle = projectedBand
    ? HEALTH_BAND_STYLES[projectedBand]
    : null;

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      interestRate,
      collateralAmount: requiredCollateral,
    }));
  }, [formData.amount, interestRate, requiredCollateral]);

  useEffect(() => {
    if (!formData.asset || !formData.collateral) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingPrices(true);
      try {
        const assets = `${formData.asset},${formData.collateral}`;
        const response = await fetch(`/api/prices?assets=${assets}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Price request failed");
        }

        const data = (await response.json()) as { prices?: PriceMap };
        if (!data.prices) {
          throw new Error("Missing prices");
        }

        setPriceMap((prev) => ({ ...prev, ...data.prices }));
        setUsingFallbackPrices(false);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPriceMap(FALLBACK_PRICES);
          setUsingFallbackPrices(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPrices(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [formData.asset, formData.collateral]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = "Please enter a valid amount";
    }

    if (!formData.duration) {
      newErrors.duration = "Please select a loan duration";
    }

    if (!formData.collateral) {
      newErrors.collateral = "Please select collateral asset";
    }

    if (
      collateralAsset &&
      collateralAmount &&
      collateralAmount > collateralAsset.balance
    ) {
      newErrors.collateralAmount = "Insufficient collateral balance";
    } else if (
      formData.amount > 0 &&
      collateralAmount < requiredCollateral
    ) {
      newErrors.collateralAmount = "Collateral must meet the 150% minimum";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("idle");
    setSubmitMessage("");
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setSubmitStatus("success");
        setSubmitMessage("Details validated successfully.");
        onSubmit(formData);
      } catch (err) {
        setSubmitStatus("error");
        setSubmitMessage("An error occurred during validation.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setSubmitStatus("error");
      setSubmitMessage("Please fix the errors in the form before continuing.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Borrow Against Collateral
        </h2>
        <p className="text-gray-600 text-sm font-medium">
          Borrow assets by providing collateral. Minimum 150% collateralization
          required.
        </p>
      </div>

      {submitMessage && (
        <div
          className={cn(
            "p-4 rounded-xl mb-6 text-sm font-medium",
            submitStatus === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200",
          )}
          role="alert"
          aria-live="polite"
        >
          {submitMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Borrow Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Asset to Borrow
          </label>
          <div className="grid grid-cols-2 gap-4">
            <AssetSelector
              assets={ASSETS}
              value={formData.asset}
              label="Asset to Borrow"
              interestRates={INTEREST_RATES}
              onChange={(asset) =>
                setFormData((prev) => ({
                  ...prev,
                  asset,
                }))
              }
            />
          </div>
        </div>

        {/* Borrow Amount */}
        <AmountInput
          label="Amount to Borrow"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.amount || 0}
          error={errors.amount}
          onChange={(amount) => {
            setFormData((prev) => ({
              ...prev,
              amount,
            }));
            if (errors.amount) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.amount;
                return next;
              });
            }
          }}
          precision={selectedAsset?.precision ?? 2}
        />

        {/* Loan Duration */}
        <div
          role="group"
          aria-labelledby="loan-duration-label"
          aria-describedby={errors.duration ? "loan-duration-error" : undefined}
        >
          <span id="loan-duration-label" className="block text-sm font-medium text-gray-700 mb-3">
            Loan Duration
          </span>
          <div className="grid grid-cols-3 gap-3">
            {LOAN_DURATIONS.map((duration) => (
              <button
                key={duration.days}
                type="button"
                aria-pressed={formData.duration === duration.days}
                onClick={() => {
                  setFormData((prev) => ({ ...prev, duration: duration.days }));
                  if (errors.duration) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.duration;
                      return next;
                    });
                  }
                }}
                className={cn(
                  "p-3 rounded-xl border-2 text-center transition-all duration-200",
                  formData.duration === duration.days
                    ? "border-[#2600FF] bg-blue-50 text-[#2600FF] ring-1 ring-[#2600FF]"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/30 text-gray-600",
                )}
              >
                <div className="font-bold text-sm">{duration.label}</div>
                <div className="text-[10px] opacity-70 font-semibold">
                  {duration.days} days
                </div>
              </button>
            ))}
          </div>
          {errors.duration && (
            <p
              id="loan-duration-error"
              className="text-xs text-red-500 font-medium mt-2"
              role="alert"
              aria-live="polite"
            >
              {errors.duration}
            </p>
          )}
        </div>

        {/* Collateral Selection */}
        <div
          role="group"
          aria-labelledby="collateral-asset-label"
          aria-describedby={errors.collateral ? "collateral-asset-error" : undefined}
        >
          <span id="collateral-asset-label" className="block text-sm font-medium text-gray-700 mb-3">
            Collateral Asset
          </span>
          <div className="grid grid-cols-2 gap-4">
            {ASSETS.map((asset) => (
              <button
                key={asset.symbol}
                type="button"
                aria-pressed={formData.collateral === asset.symbol}
                aria-label={`${asset.symbol} collateral, balance ${asset.balance.toLocaleString()}`}
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    collateral: asset.symbol,
                  }));
                  if (errors.collateral) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.collateral;
                      return next;
                    });
                  }
                }}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                  formData.collateral === asset.symbol
                    ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                    : "border-gray-100 hover:border-gray-200 bg-gray-50/30",
                )}
              >
                <div className="font-bold text-sm mb-1">{asset.symbol}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  Bal: {asset.balance.toLocaleString()}
                </div>
              </button>
            ))}
          </div>
          {errors.collateral && (
            <p
              id="collateral-asset-error"
              className="text-xs text-red-500 font-medium mt-2"
              role="alert"
              aria-live="polite"
            >
              {errors.collateral}
            </p>
          )}
        </div>

        {/* Collateral Amount */}
        <AmountInput
          label="Collateral Amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.collateralAmount || 0}
          error={errors.collateralAmount}
          helperText={`Minimum required: ${requiredCollateral.toLocaleString()} ${formData.collateral}`}
          onChange={(collateralAmount) => {
            setFormData((prev) => ({
              ...prev,
              collateralAmount,
            }));
            if (errors.collateralAmount) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.collateralAmount;
                return next;
              });
            }
          }}
          precision={collateralAsset?.precision ?? 2}
        />

        {/* Collateral Requirements */}
        {formData.amount > 0 && (
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 space-y-3">
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Collateral Requirements
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-amber-700">Loan Amount:</span>
                <span className="text-gray-900">
                  {formData.amount.toLocaleString()} {formData.asset}
                </span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-amber-700">Required (150%):</span>
                <span className="font-bold text-[#2600FF]">
                  {requiredCollateral.toLocaleString()} {formData.collateral}
                </span>
              </div>
              {collateralAsset && (
                <div className="flex justify-between text-xs font-medium border-t border-amber-200 pt-2.5">
                  <span className="text-amber-700">Your Balance:</span>
                  <span
                    className={cn(
                      "font-bold",
                      collateralAsset.balance >= requiredCollateral
                        ? "text-green-600"
                        : "text-red-600",
                    )}
                  >
                    {collateralAsset.balance.toLocaleString()}{" "}
                    {formData.collateral}
                  </span>
                </div>
              )}
            </div>
            {errors.collateralAmount && (
              <p
                className="text-xs text-red-500 font-bold"
                role="alert"
                aria-live="polite"
              >
                {errors.collateralAmount}
              </p>
            )}
          </div>
        )}

        {projectedHealth && projectedBandStyle && (
          <div
            className={cn(
              "rounded-xl p-5 border space-y-3",
              projectedBandStyle.bg,
              projectedBandStyle.border,
            )}
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    projectedBandStyle.text,
                  )}
                >
                  Projected Health Preview
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Uses the live price feed when available, with a local fallback
                  for preview-only estimates.
                </p>
              </div>
              <span
                className={cn(
                  "text-xs font-bold px-2 py-1 rounded-full bg-white/70",
                  projectedBandStyle.text,
                )}
              >
                {projectedBandStyle.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-medium">
              <div className="rounded-lg bg-white/70 p-3">
                <span className="block text-gray-500">Health factor</span>
                <span className={cn("text-lg font-bold", projectedBandStyle.text)}>
                  {projectedHealth.healthFactor.toFixed(2)}x
                </span>
              </div>
              <div className="rounded-lg bg-white/70 p-3">
                <span className="block text-gray-500">Liquidation price</span>
                <span className="text-lg font-bold text-gray-900">
                  ${projectedHealth.liquidationPrice.toFixed(2)}
                </span>
                <span className="block text-gray-500">
                  per {formData.collateral}
                </span>
              </div>
            </div>
            <p
              className={cn("text-xs font-semibold", projectedBandStyle.text)}
              role={projectedBand === "healthy" ? undefined : "alert"}
            >
              {projectedBandStyle.helper}
            </p>
            {(usingFallbackPrices || isLoadingPrices) && (
              <p className="text-[11px] text-gray-500">
                {isLoadingPrices
                  ? "Refreshing price data..."
                  : "Using fallback prices because the live feed is unavailable."}
              </p>
            )}
          </div>
        )}

        {/* Terms */}
        <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
          <h3 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wider">
            Borrowing Terms
          </h3>
          <ul className="text-xs text-gray-500 space-y-2 font-medium">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Interest rate: {interestRate}% APR
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Min collateralization: 150%
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Liquidation threshold: 120%
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Early repayment allowed
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
        >
          Review Loan Request
        </Button>
      </form>
    </div>
  );
}
