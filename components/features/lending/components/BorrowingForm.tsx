"use client";

import { useEffect, useRef, useState } from "react";
import { LendingData } from "@/app/lending/page";
import Button from "@/components/shared/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ASSETS } from "@/lib/assets";
import AssetSelector from "@/components/shared/ui/AssetSelector";
import { WalletGate } from "@/components/shared/ui/WalletGate";
import { AmountInput } from "@/components/shared/ui/AmountInput";
import { Tooltip } from "@/components/atoms/Tooltip/Tooltip";
import { IconButton } from "@/components/atoms/IconButton/IconButton";
import StatusAnnouncer from "@/components/shared/common/StatusAnnouncer";
import {
  FALLBACK_PRICES,
  MAX_TARGET_HEALTH_FACTOR,
  MIN_TARGET_HEALTH_FACTOR,
  calculateCollateralForTargetHealth,
  clampTargetHealthFactor,
  calculateProjectedBorrowHealth,
  calculateRequiredCollateralAmount,
  getHealthBand,
  isProjectedBorrowCollateralized,
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

const TARGET_HEALTH_PRESETS = [1.5, 2, 2.5] as const;

const HEALTH_BAND_STYLES = {
  healthy: {
    label: "Healthy",
    text: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    helper:
      "Projected collateral buffer is comfortably above the liquidation threshold.",
  },
  "at-risk": {
    label: "At Risk",
    text: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
    helper:
      "Projected position is close to the liquidation threshold. Consider adding collateral.",
  },
  critical: {
    label: "Critical",
    text: "text-red-700",
    border: "border-red-200",
    bg: "bg-red-50",
    helper:
      "Projected position is undercollateralised. Add collateral before submitting.",
  },
} as const;

/** Inclusive lower bound for a custom loan duration (days). */
export const CUSTOM_DURATION_MIN_DAYS = 1;

/** Inclusive upper bound for a custom loan duration (days). */
export const CUSTOM_DURATION_MAX_DAYS = 365;

export default function BorrowingForm({
  onSubmit,
  initialData,
}: BorrowingFormProps) {
  const [formData, setFormData] = useState<LendingData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [priceMap, setPriceMap] = useState<PriceMap>(FALLBACK_PRICES);
  const [usingFallbackPrices, setUsingFallbackPrices] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const lastSuggestedCollateral = useRef<number | null>(null);

  // "preset" = one of the LOAN_DURATIONS chips is active
  // "custom" = the Custom chip is active and the numeric input is visible
  const [durationMode, setDurationMode] = useState<"preset" | "custom">(
    "preset",
  );
  // Raw string so the input can be empty / partially typed without coercion
  const [customDays, setCustomDays] = useState<string>("");
  const [customDaysError, setCustomDaysError] = useState<string>("");
  const [targetHealthMode, setTargetHealthMode] = useState<"preset" | "custom">(
    "preset",
  );
  const [targetHealthFactor, setTargetHealthFactor] = useState<number>(2);
  const [customTargetHealth, setCustomTargetHealth] = useState<string>("");

  const selectedAsset = ASSETS.find((a) => a.symbol === formData.asset);
  const collateralAsset = ASSETS.find((a) => a.symbol === formData.collateral);
  const interestRate =
    INTEREST_RATES[formData.asset as keyof typeof INTEREST_RATES];

  const collateralAmount = formData.collateralAmount ?? 0;
  const requiredCollateral = calculateRequiredCollateralAmount({
    loanAmount: formData.amount,
    borrowAsset: formData.asset,
    collateralAsset: formData.collateral ?? "",
    prices: priceMap,
  });
  const projectedHealth = calculateProjectedBorrowHealth({
    loanAmount: formData.amount,
    borrowAsset: formData.asset,
    collateralAmount,
    collateralAsset: formData.collateral ?? "",
    prices: priceMap,
  });
  const projectedBand = projectedHealth
    ? getHealthBand(projectedHealth.healthFactor)
    : null;
  const projectedBandStyle = projectedBand
    ? HEALTH_BAND_STYLES[projectedBand]
    : null;
  const targetCollateralAmount = calculateCollateralForTargetHealth({
    loanAmount: formData.amount,
    borrowAsset: formData.asset,
    collateralAsset: formData.collateral ?? "",
    prices: priceMap,
    targetHealthFactor,
  });
  const topUpAmount =
    targetCollateralAmount === null
      ? null
      : Math.max(0, targetCollateralAmount - collateralAmount);
  const targetFillAmount =
    targetCollateralAmount === null
      ? null
      : Math.max(collateralAmount, targetCollateralAmount);
  const clampedTargetFillAmount =
    targetFillAmount !== null && collateralAsset
      ? Math.min(targetFillAmount, collateralAsset.balance)
      : targetFillAmount;
  const targetExceedsBalance = Boolean(
    targetCollateralAmount !== null &&
    collateralAsset &&
    targetCollateralAmount > collateralAsset.balance,
  );
  const borrowPrice = priceMap[formData.asset];
  const collateralPrice = formData.collateral
    ? priceMap[formData.collateral]
    : undefined;
  const borrowPriceAvailable = Boolean(
    Number.isFinite(borrowPrice) && borrowPrice > 0,
  );
  const collateralPriceAvailable = Boolean(
    Number.isFinite(collateralPrice) && (collateralPrice ?? 0) > 0,
  );

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      interestRate,
    }));
  }, [interestRate]);

  useEffect(() => {
    if (requiredCollateral === null) {
      lastSuggestedCollateral.current = null;
      return;
    }

    setFormData((prev) => {
      const currentAmount = prev.collateralAmount ?? 0;
      const shouldSuggestMinimum =
        currentAmount <= 0 || currentAmount === lastSuggestedCollateral.current;

      lastSuggestedCollateral.current = requiredCollateral;
      return shouldSuggestMinimum
        ? { ...prev, collateralAmount: requiredCollateral }
        : prev;
    });
  }, [requiredCollateral]);

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

        setPriceMap(data.prices);
        setUsingFallbackPrices(false);
      } catch {
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

  // ---------------------------------------------------------------------------
  // Custom-duration helpers
  // ---------------------------------------------------------------------------

  /**
   * Validates the raw string coming from the custom-days input.
   *
   * Returns an error message string on failure, or `""` on success.
   * When valid, it also calls the `onValid` callback with the parsed integer.
   */
  const validateCustomDays = (
    raw: string,
    onValid?: (days: number) => void,
  ): string => {
    if (raw.trim() === "" || isNaN(Number(raw))) {
      return "Please enter a number of days";
    }

    const parsed = Number(raw);

    if (!Number.isInteger(parsed)) {
      return "Duration must be a whole number of days";
    }

    if (parsed < CUSTOM_DURATION_MIN_DAYS) {
      return `Minimum duration is ${CUSTOM_DURATION_MIN_DAYS} day`;
    }

    if (parsed > CUSTOM_DURATION_MAX_DAYS) {
      return `Maximum duration is ${CUSTOM_DURATION_MAX_DAYS} days`;
    }

    onValid?.(parsed);
    return "";
  };

  const handleCustomDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomDays(raw);

    const errorMsg = validateCustomDays(raw, (days) => {
      setFormData((prev) => ({ ...prev, duration: days }));
      // Clear the duration field error if the user fixes it
      if (errors.duration) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.duration;
          return next;
        });
      }
    });

    setCustomDaysError(errorMsg);
  };

  const formatCollateralUnits = (amount: number): string =>
    amount.toLocaleString(undefined, {
      maximumFractionDigits: collateralAsset?.precision ?? 2,
    });

  const handleTargetPreset = (target: number) => {
    setTargetHealthMode("preset");
    setCustomTargetHealth("");
    setTargetHealthFactor(target);
  };

  const handleCustomTargetHealthChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const raw = e.target.value;
    setCustomTargetHealth(raw);

    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      setTargetHealthFactor(clampTargetHealthFactor(parsed));
    }
  };

  const applyTargetCollateral = () => {
    if (clampedTargetFillAmount === null) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      collateralAmount: clampedTargetFillAmount,
    }));
    if (errors.collateralAmount) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.collateralAmount;
        return next;
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Form validation / submission
  // ---------------------------------------------------------------------------

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = "Please enter a valid amount";
    }

    if (!formData.duration) {
      newErrors.duration = "Please select a loan duration";
    }

    // In custom mode, validate the current raw input at submit time so a quick
    // submit cannot race the customDaysError state update.
    if (durationMode === "custom") {
      const customDurationError = validateCustomDays(customDays);
      if (customDurationError) {
        newErrors.duration = customDurationError;
      }
    }

    if (!formData.collateral) {
      newErrors.collateral = "Please select collateral asset";
    }

    if (!collateralAmount || collateralAmount <= 0) {
      newErrors.collateralAmount = "Please enter a collateral amount";
    } else if (!borrowPriceAvailable || !collateralPriceAvailable) {
      newErrors.collateralAmount =
        "A current price is required for both assets before submitting";
    } else if (collateralAsset && collateralAmount > collateralAsset.balance) {
      newErrors.collateralAmount = "Insufficient collateral balance";
    } else if (
      formData.amount > 0 &&
      !isProjectedBorrowCollateralized({
        loanAmount: formData.amount,
        borrowAsset: formData.asset,
        collateralAmount,
        collateralAsset: formData.collateral ?? "",
        prices: priceMap,
      })
    ) {
      newErrors.collateralAmount =
        "Collateral must be at least 150% of the borrowed value";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    setSubmitMessage("");
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setStatus("success");
        setSubmitMessage("Details validated successfully.");
        onSubmit(formData);
      } catch (err) {
        setStatus("error");
        setSubmitMessage("An error occurred during validation.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setStatus("error");
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

      <StatusAnnouncer status={status} type="borrow" message={submitMessage} />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Borrow Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Asset to Borrow{" "}
            <Tooltip content="The asset you wish to borrow (must be collateralized).">
              <IconButton aria-label="Help" size="sm" variant="ghost" />
            </Tooltip>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <AssetSelector
              assets={ASSETS}
              value={formData.asset}
              label="Asset to Borrow"
              interestRates={INTEREST_RATES}
              onChange={(asset) => {
                setFormData((prev) => ({
                  ...prev,
                  asset,
                }));
                if (errors.amount || errors.collateralAmount) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.amount;
                    delete next.collateralAmount;
                    return next;
                  });
                }
              }}
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
          max={selectedAsset?.balance ?? 0}
        />

        {/* Loan Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Loan Duration
          </label>

          {/* Preset chips + Custom chip */}
          <div className="grid grid-cols-3 gap-3">
            {LOAN_DURATIONS.map((duration) => (
              <button
                key={duration.days}
                type="button"
                onClick={() => {
                  setDurationMode("preset");
                  setCustomDays("");
                  setCustomDaysError("");
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
                  durationMode === "preset" &&
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

            {/* Custom chip */}
            <button
              type="button"
              aria-pressed={durationMode === "custom"}
              onClick={() => {
                setDurationMode("custom");
                // Re-validate whatever is already in the input (or empty)
                const errorMsg = validateCustomDays(customDays, (days) => {
                  setFormData((prev) => ({ ...prev, duration: days }));
                });
                setCustomDaysError(errorMsg);
              }}
              className={cn(
                "p-3 rounded-xl border-2 text-center transition-all duration-200",
                durationMode === "custom"
                  ? "border-[#2600FF] bg-blue-50 text-[#2600FF] ring-1 ring-[#2600FF]"
                  : "border-gray-100 hover:border-gray-200 bg-gray-50/30 text-gray-600",
              )}
            >
              <div className="font-bold text-sm">Custom</div>
              <div className="text-[10px] opacity-70 font-semibold">
                1–365 days
              </div>
            </button>
          </div>

          {/* Custom days input — only visible in custom mode */}
          {durationMode === "custom" && (
            <div className="mt-3">
              <label
                htmlFor="custom-loan-duration"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Enter number of days
              </label>
              <input
                id="custom-loan-duration"
                type="number"
                min={CUSTOM_DURATION_MIN_DAYS}
                max={CUSTOM_DURATION_MAX_DAYS}
                step={1}
                value={customDays}
                onChange={handleCustomDaysChange}
                placeholder={`${CUSTOM_DURATION_MIN_DAYS}–${CUSTOM_DURATION_MAX_DAYS}`}
                aria-label="Custom loan duration in days"
                aria-describedby={
                  customDaysError ? "custom-days-error" : undefined
                }
                aria-invalid={customDaysError ? true : undefined}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                  customDaysError
                    ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : "border-gray-200 bg-white focus:border-[#2600FF] focus:ring-1 focus:ring-[#2600FF]",
                )}
              />
              {customDaysError && (
                <p
                  id="custom-days-error"
                  className="text-xs text-red-500 font-medium mt-1"
                  role="alert"
                  aria-live="polite"
                >
                  {customDaysError}
                </p>
              )}
            </div>
          )}

          {errors.duration && (
            <p
              className="text-xs text-red-500 font-medium mt-2"
              role="alert"
              aria-live="polite"
            >
              {errors.duration}
            </p>
          )}
        </div>

        {/* Collateral Selection */}
        <div>
          <AssetSelector
            assets={ASSETS}
            value={formData.collateral ?? ""}
            label="Collateral Asset"
            onChange={(collateral) => {
              setFormData((prev) => ({ ...prev, collateral }));
              if (errors.collateral || errors.collateralAmount) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.collateral;
                  delete next.collateralAmount;
                  return next;
                });
              }
            }}
          />
          {errors.collateral && (
            <p
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
          helperText={
            requiredCollateral === null
              ? "A price for both assets is needed to calculate the minimum"
              : `Minimum required: ${requiredCollateral.toLocaleString(
                  undefined,
                  {
                    maximumFractionDigits: collateralAsset?.precision ?? 2,
                  },
                )} ${formData.collateral}`
          }
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
          max={collateralAsset?.balance ?? 0}
        />

        {/* Target Health Shortcut */}
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              Target Health Shortcut
            </h3>
            <p className="text-xs text-blue-700 font-medium mt-1">
              Pick a target health factor to prefill the collateral amount.
            </p>
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            role="group"
            aria-label="Target health presets"
          >
            {TARGET_HEALTH_PRESETS.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => handleTargetPreset(target)}
                className={cn(
                  "rounded-lg border-2 px-3 py-2 text-sm font-bold transition-colors",
                  targetHealthMode === "preset" && targetHealthFactor === target
                    ? "border-[#2600FF] bg-white text-[#2600FF]"
                    : "border-blue-100 bg-white/70 text-blue-700 hover:border-blue-200",
                )}
                aria-pressed={
                  targetHealthMode === "preset" && targetHealthFactor === target
                }
              >
                {target.toFixed(1)}x
              </button>
            ))}
            <button
              type="button"
              aria-label="Use target health input"
              onClick={() => {
                setTargetHealthMode("custom");
                if (!customTargetHealth) {
                  setCustomTargetHealth(targetHealthFactor.toString());
                }
              }}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-sm font-bold transition-colors",
                targetHealthMode === "custom"
                  ? "border-[#2600FF] bg-white text-[#2600FF]"
                  : "border-blue-100 bg-white/70 text-blue-700 hover:border-blue-200",
              )}
              aria-pressed={targetHealthMode === "custom"}
            >
              Target
            </button>
          </div>

          {targetHealthMode === "custom" && (
            <div>
              <label
                htmlFor="custom-target-health-factor"
                className="block text-xs font-medium text-blue-800 mb-1"
              >
                Custom target health factor
              </label>
              <input
                id="custom-target-health-factor"
                aria-label="Custom target health factor"
                type="number"
                min={MIN_TARGET_HEALTH_FACTOR}
                max={MAX_TARGET_HEALTH_FACTOR}
                step="0.1"
                value={customTargetHealth}
                onChange={handleCustomTargetHealthChange}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2600FF] focus:ring-1 focus:ring-[#2600FF]"
              />
              <p className="text-[11px] text-blue-600 font-medium mt-1">
                Targets are clamped between{" "}
                {MIN_TARGET_HEALTH_FACTOR.toFixed(1)}x and{" "}
                {MAX_TARGET_HEALTH_FACTOR.toFixed(1)}x.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium">
            <div className="rounded-lg bg-white/75 p-3">
              <span className="block text-blue-700">Suggested collateral</span>
              <span className="text-base font-bold text-gray-900">
                {targetCollateralAmount === null
                  ? "Enter borrow details"
                  : `${formatCollateralUnits(targetCollateralAmount)} ${
                      formData.collateral
                    }`}
              </span>
            </div>
            <div className="rounded-lg bg-white/75 p-3">
              <span className="block text-blue-700">Top-up needed</span>
              <span className="text-base font-bold text-gray-900">
                {topUpAmount === null
                  ? "Unavailable"
                  : `${formatCollateralUnits(topUpAmount)} ${
                      formData.collateral
                    }`}
              </span>
            </div>
          </div>

          {targetExceedsBalance && collateralAsset && (
            <p className="text-xs font-semibold text-amber-700" role="status">
              Target requires more than your balance, so applying uses your
              available {formatCollateralUnits(collateralAsset.balance)}{" "}
              {formData.collateral}.
            </p>
          )}
          {topUpAmount === 0 && targetCollateralAmount !== null && (
            <p className="text-xs font-semibold text-green-700" role="status">
              Existing collateral already reaches the selected target.
            </p>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={clampedTargetFillAmount === null}
            onClick={applyTargetCollateral}
          >
            {targetExceedsBalance
              ? "Apply Available Balance"
              : "Apply Suggested Collateral"}
          </Button>
        </div>

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
                  {requiredCollateral === null
                    ? "Price unavailable"
                    : `${requiredCollateral.toLocaleString(undefined, {
                        maximumFractionDigits: collateralAsset?.precision ?? 2,
                      })} ${formData.collateral}`}
                </span>
              </div>
              {collateralAsset && (
                <div className="flex justify-between text-xs font-medium border-t border-amber-200 pt-2.5">
                  <span className="text-amber-700">Your Balance:</span>
                  <span
                    className={cn(
                      "font-bold",
                      requiredCollateral !== null &&
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
                  Compares the borrowed and collateral assets using their USD
                  prices.
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
                <span
                  className={cn("text-lg font-bold", projectedBandStyle.text)}
                >
                  {projectedHealth.healthFactor.toFixed(2)}x
                </span>
              </div>
              <div className="rounded-lg bg-white/70 p-3">
                <span className="block text-gray-500">
                  Collateral liquidation price
                </span>
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

        {formData.amount > 0 &&
          collateralAmount > 0 &&
          (!borrowPriceAvailable || !collateralPriceAvailable) && (
            <p className="text-xs font-semibold text-red-600" role="alert">
              A current price is unavailable for this asset pair. Submission is
              blocked until both prices are available.
            </p>
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
        <WalletGate fallbackText="Connect wallet to review loan request">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
          >
            Review Loan Request
          </Button>
        </WalletGate>
      </form>
    </div>
  );
}
