"use client";
import { useState, useEffect, useRef } from "react";
import { LendingData } from "@/app/lending/page";
import type { CalculationResult } from "@/lib/lending/types";
import { calculateQuote } from "@/lib/lending/quote";
import { Input } from "@/components/shared/ui/Input";
import Button from "@/components/shared/ui/Button";
import { cn } from "@/lib/utils/cn";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import AssetSelector from "@/components/shared/ui/AssetSelector";
import { WalletGate } from "@/components/shared/ui/WalletGate";
import { AmountInput } from "@/components/shared/ui/AmountInput";
import { Tooltip } from "@/components/atoms/Tooltip/Tooltip";
import { IconButton } from "@/components/atoms/IconButton/IconButton";
import StatusAnnouncer from "@/components/shared/common/StatusAnnouncer";

interface LendingFormProps {
  onSubmit: (data: LendingData) => void;
  initialData: LendingData;
}

const INTEREST_RATES = {
  XLM: { min: 5.0, max: 12.0, default: 8.5 },
  USDC: { min: 4.0, max: 10.0, default: 6.5 },
  BTC: { min: 3.0, max: 8.0, default: 5.5 },
  ETH: { min: 3.5, max: 9.0, default: 6.0 },
};

const SUPPORTED_ASSETS = new Set(Object.keys(INTEREST_RATES));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLendingAsset(value: string): value is keyof typeof INTEREST_RATES {
  return SUPPORTED_ASSETS.has(value);
}

function parseQuoteResponse(payload: unknown): CalculationResult | null {
  if (!isRecord(payload) || !isRecord(payload.result)) return null;
  const candidate = payload.result as unknown as CalculationResult;
  if (
    !isFiniteNumber(candidate.dailyEarnings) ||
    !isFiniteNumber(candidate.totalEarnings)
  ) {
    return null;
  }
  if (candidate.dailyEarnings < 0 || candidate.totalEarnings < 0) return null;
  if (candidate.dailyEarnings > 1e12 || candidate.totalEarnings > 1e12) return null;
  return candidate;
}
export default function LendingForm({
  onSubmit,
  initialData,
}: LendingFormProps) {
  const [formData, setFormData] = useState<LendingData>(() => {
    if (typeof window === "undefined") return initialData;
    try {
      const saved = localStorage.getItem("lending-draft");
      if (saved) {
        return { ...initialData, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore malformed or inaccessible drafts.
    }
    return initialData;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [preview, setPreview] = useState<{
    result: CalculationResult | null;
    source: "local" | "server" | null;
    loading: boolean;
  }>({ result: null, source: null, loading: false });

  // Track in-flight requests so earlier fetches cannot overwrite the latest
  // preview once a newer input is in flight.
  const requestSeqRef = useRef(0);

  const { assetsWithBalances } = useWalletBalances();
  const assetsWithBalancesRef = useRef(assetsWithBalances);
  useEffect(() => {
    assetsWithBalancesRef.current = assetsWithBalances;
  });
  const selectedAsset = assetsWithBalances.find((a) => a.symbol === formData.asset);
  const rates = INTEREST_RATES[formData.asset as keyof typeof INTEREST_RATES];

  useEffect(() => {
    if (rates) {
      setFormData((prev) => ({ ...prev, interestRate: rates.default }));
    }
  }, [formData.asset, rates]);

  // Persist draft to localStorage whenever form data changes, so users can
  // resume a partially completed commitment later.
  useEffect(() => {
    try {
      localStorage.setItem("lending-draft", JSON.stringify(formData));
    } catch {
      // Ignore quota/security errors; draft persistence is best-effort.
    }
  }, [formData]);

  // Debounced authoritative quote preview from /api/quote with a local
  // fallback computed via calculateQuote(). Aborts in-flight requests so
  // stale responses can never overwrite a fresher preview.
  useEffect(() => {
    if (
      !formData.amount ||
      typeof formData.amount !== "number" ||
      !Number.isFinite(formData.amount) ||
      formData.amount <= 0 ||
      !selectedAsset ||
      formData.amount > selectedAsset.balance ||
      !rates ||
      typeof formData.interestRate !== "number" ||
      !Number.isFinite(formData.interestRate) ||
      formData.interestRate < rates.min ||
      formData.interestRate > rates.max
    ) {
      setPreview({ result: null, source: null, loading: false });
      return;
    }

    // Show the local fallback immediately for snappy UX.
    const local = calculateQuote("lend", formData);
    if (!local.ok) {
      setPreview({ result: null, source: null, loading: false });
      return;
    }
    setPreview({ result: local.result, source: "local", loading: true });

    const controller = new AbortController();
    const seq = ++requestSeqRef.current;
    const handle = setTimeout(async () => {
      try {
        const response = await fetch("/api/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "lend",
            data: {
              asset: formData.asset,
              amount: formData.amount,
              interestRate: formData.interestRate,
            },
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (seq === requestSeqRef.current) {
            setPreview((prev) => ({ ...prev, loading: false }));
          }
          return;
        }
        const payload: unknown = await response.json();
        if (controller.signal.aborted) return;
        // Only apply if this is still the latest in-flight request.
        if (seq !== requestSeqRef.current) return;
        const result = parseQuoteResponse(payload);
        if (result) {
          setPreview({
            result,
            source: "server",
            loading: false,
          });
        } else {
          // Malformed or out-of-bounds server response: keep local estimate.
          setPreview((prev) => ({ ...prev, loading: false }));
        }
      } catch {
        if (controller.signal.aborted) return;
        if (seq !== requestSeqRef.current) return;
        // Local fallback already in place; just clear the loading flag.
        setPreview((prev) => ({ ...prev, loading: false }));
      }
    }, 300);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [formData.amount, formData.interestRate, formData.asset, selectedAsset?.balance]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!rates) {
      newErrors.asset = "Unsupported asset selected.";
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = "Please enter a valid amount";
    } else if (selectedAsset && formData.amount > selectedAsset.balance) {
      newErrors.amount = `Insufficient balance. Maximum available: ${selectedAsset.balance.toLocaleString()} ${formData.asset}`;
    }

    if (
      rates &&
      (!formData.interestRate ||
        formData.interestRate < rates.min ||
        formData.interestRate > rates.max)
    ) {
      newErrors.interestRate = "Interest rate is outside the allowed range.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setStatus("idle");
    setSubmitMessage("");
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        // Simulate validation/processing; re-check authorization at submit
        // time so wallet disconnects or balance changes cannot be ignored.
        await new Promise((resolve) => setTimeout(resolve, 800));
        const currentAsset = assetsWithBalancesRef.current.find(
          (a) => a.symbol === formData.asset,
        );
        if (
          !currentAsset ||
          !isLendingAsset(formData.asset) ||
          typeof formData.amount !== "number" ||
          !Number.isFinite(formData.amount) ||
          formData.amount <= 0 ||
          formData.amount > currentAsset.balance ||
          !rates ||
          typeof formData.interestRate !== "number" ||
          !Number.isFinite(formData.interestRate) ||
          formData.interestRate < rates.min ||
          formData.interestRate > rates.max
        ) {
          throw new Error("Wallet authorization or available inputs changed.");
        }
        setStatus("success");
        setSubmitMessage("Details validated successfully.");
        onSubmit(formData);
        try {
          localStorage.removeItem("lending-draft");
        } catch {
          // Ignore storage cleanup errors.
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "An error occurred during validation.";
        setStatus("error");
        setSubmitMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setStatus("error");
      setSubmitMessage("Please fix the errors in the form before continuing.");
      e.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  };

  const handleMaxAmount = () => {
    if (selectedAsset) {
      setFormData((prev) => ({ ...prev, amount: selectedAsset.balance }));
      if (errors.amount) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.amount;
          return next;
        });
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Lend Your Assets
        </h2>
        <p className="text-gray-600 text-sm">
          Choose an asset and amount to lend, then set your desired interest
          rate
        </p>
      </div>

      <StatusAnnouncer status={status} type="lend" message={submitMessage} />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Asset
          </label>
          <div className="grid grid-cols-2 gap-4">
            <AssetSelector
              assets={assetsWithBalances}
              value={formData.asset}
              label="Select Asset"
              onChange={(asset) => {
                setFormData((prev) => ({
                  ...prev,
                  asset,
                }));

                setErrors({});
              }}
            />
          </div>
          {errors.asset && (
            <p className="text-xs text-red-500 font-medium" role="alert">
              {errors.asset}
            </p>
          )}
        </div>

        {/* Amount Input */}
        <div className="relative">
          <AmountInput
            label="Amount to Lend"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.amount || 0}
            error={errors.amount}
            helperText={
              selectedAsset
                ? `Available: ${selectedAsset.balance.toLocaleString()} ${formData.asset}`
                : undefined
            }
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
            onMax={handleMaxAmount}
            max={selectedAsset?.balance ?? 0}
          />
        </div>

        {/* Interest Rate */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="interest-rate" className="text-sm font-medium text-gray-700 flex items-center">
              Interest Rate (% APY)
              <Tooltip content="Annual Percentage Yield (APR) is the annual rate of return, including compounding.">
                <IconButton aria-label="Help" size="sm" variant="ghost" />
              </Tooltip>
            </label>
            <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
              {formData.interestRate.toFixed(1)}% APY
            </span>
          </div>

          <div className="px-1">
            <input
              id="interest-rate"
              type="range"
              min={rates.min}
              max={rates.max}
              step="0.1"
              value={formData.interestRate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  interestRate: parseFloat(e.target.value),
                }))
              }
              aria-label="Interest rate"
              aria-valuetext={`${formData.interestRate.toFixed(1)}% APY`}
              aria-invalid={!!errors.interestRate}
              aria-describedby={errors.interestRate ? "interest-rate-error" : undefined}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tighter">
              <span>MIN: {rates.min.toFixed(1)}%</span>
              <span>DEFAULT: {rates.default.toFixed(1)}%</span>
              <span>MAX: {rates.max.toFixed(1)}%</span>
            </div>
          </div>

          {errors.interestRate && (
            <p
              id="interest-rate-error"
              className="text-xs text-red-500 font-medium"
              role="alert"
              aria-live="polite"
            >
              {errors.interestRate}
            </p>
          )}
        </div>

        {/* Terms */}
        <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
          <h3 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wider">
            Lending Terms
          </h3>
          <ul className="text-xs text-gray-500 space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Minimum lending period: 7 days
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Interest is calculated daily and compounded
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Withdraw funds anytime after minimum period
            </li>
            <li className="flex items-start gap-2 text-gray-400">
              <span className="mt-0.5">ℹ</span>
              Early withdrawal may incur a 0.5% penalty fee
            </li>
          </ul>
        </div>

        {/* Quote Preview */}
        {preview.result && (
          <div
            className="bg-blue-50 border border-blue-200 rounded-xl p-5"
            data-testid="lending-quote-preview"
            aria-live="polite"
            aria-busy={preview.loading}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                Lending Quote Preview
              </h3>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded",
                  preview.source === "server"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700",
                )}
                data-testid="lending-quote-source"
              >
                {preview.source === "server" ? "Live API" : "Local estimate"}
                {preview.loading ? " · updating" : ""}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">Daily earnings</span>
                <span
                  className="font-semibold text-gray-900"
                  data-testid="lending-quote-daily"
                >
                  ${preview.result.dailyEarnings.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">
                  Total earnings (30 days)
                </span>
                <span
                  className="font-semibold text-gray-900"
                  data-testid="lending-quote-total"
                >
                  ${preview.result.totalEarnings.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <WalletGate fallbackText="Connect wallet to review offer">
          <Button
            type="submit"
            variant="success"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
          >
            Review Lending Offer
          </Button>
        </WalletGate>
      </form>
    </div>
  );
}
