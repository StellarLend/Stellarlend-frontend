"use client";

import { useState, useEffect } from "react";
import { LendingData } from "@/app/lending/page";
import { Input } from "@/components/shared/ui/Input";
import Button from "@/components/shared/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ASSETS } from "@/lib/assets";
import AssetSelector from "@/components/shared/ui/AssetSelector";
import { AmountInput } from "@/components/shared/ui/AmountInput";
import { Tooltip } from "@/components/atoms/Tooltip/Tooltip";
import { IconButton } from "@/components/atoms/IconButton/IconButton";
import StatusAnnouncer from "@/components/shared/common/StatusAnnouncer";

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
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  // "preset" = one of the LOAN_DURATIONS chips is active
  // "custom" = the Custom chip is active and the numeric input is visible
  const [durationMode, setDurationMode] = useState<"preset" | "custom">("preset");
  // Raw string so the input can be empty / partially typed without coercion
  const [customDays, setCustomDays] = useState<string>("");
  const [customDaysError, setCustomDaysError] = useState<string>("");

  const selectedAsset = ASSETS.find((a) => a.symbol === formData.asset);
  const collateralAsset = ASSETS.find((a) => a.symbol === formData.collateral);
  const interestRate =
    INTEREST_RATES[formData.asset as keyof typeof INTEREST_RATES];

  // Calculate required collateral (150% of loan amount)
  const requiredCollateral = formData.amount * 1.5;

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      interestRate,
      collateralAmount: requiredCollateral,
    }));
  }, [formData.amount, interestRate, requiredCollateral]);

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

    // In custom mode, an in-progress validation error must also block submit
    if (durationMode === "custom" && customDaysError) {
      newErrors.duration = customDaysError;
    }

    if (!formData.collateral) {
      newErrors.collateral = "Please select collateral asset";
    }

    if (
      collateralAsset &&
      formData.collateralAmount &&
      formData.collateralAmount > collateralAsset.balance
    ) {
      newErrors.collateralAmount = "Insufficient collateral balance";
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
          <label className="block text-sm font-medium text-gray-700 mb-3">Asset to Borrow <Tooltip content="The asset you wish to borrow (must be collateralized)."><IconButton aria-label="Help" size="sm" variant="ghost" /></Tooltip></label>
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
          value={formData.amount || ""}
          error={errors.amount}
          onChange={(e) => {
            setFormData((prev) => ({
              ...prev,
              amount: parseFloat(e.target.value) || 0,
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
                  durationMode === "preset" && formData.duration === duration.days
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
                aria-describedby={customDaysError ? "custom-days-error" : undefined}
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
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Collateral Asset
          </label>
          <div className="grid grid-cols-2 gap-4">
            {ASSETS.map((asset) => (
              <button
                key={asset.symbol}
                type="button"
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
          max={collateralAsset?.balance ?? 0}
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
