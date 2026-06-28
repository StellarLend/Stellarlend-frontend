"use client";

import { useMemo, useState } from "react";
import type { CalculationResult, LendingData } from "@/lib/lending/types";
import { Input } from "@/components/shared/ui/Input";
import { AmountInput } from "@/components/shared/ui/AmountInput";
import Button from "@/components/shared/ui/Button";
import HealthFactorBadge from "@/components/shared/ui/HealthFactorBadge";
import { WalletGate } from "@/components/shared/ui/WalletGate";
import PositionSummary from "@/components/features/dashboard/components/PositionSummary";
import { cn } from "@/lib/utils/cn";
import StatusAnnouncer from '@/components/shared/common/StatusAnnouncer';

export interface BorrowPosition {
  id: string;
  asset: string;
  outstandingDebt: number;
  interestRate: number;
  collateralAsset: string;
  collateralAmount: number;
  healthFactor: number;
  duration?: number;
}

interface RepayFormProps {
  onSubmit: (data: LendingData, quote: CalculationResult | null) => void;
  positions?: BorrowPosition[];
  initialPositionId?: string;
}

const DEFAULT_POSITIONS: BorrowPosition[] = [
  {
    id: "xlm-borrow-001",
    asset: "XLM",
    outstandingDebt: 1500,
    interestRate: 12,
    collateralAsset: "XLM",
    collateralAmount: 5000,
    healthFactor: 1.5,
    duration: 30,
  },
  {
    id: "usdc-borrow-002",
    asset: "USDC",
    outstandingDebt: 2200,
    interestRate: 10.5,
    collateralAsset: "ETH",
    collateralAmount: 6200,
    healthFactor: 1.18,
    duration: 60,
  },
];

const formatAmount = (amount: number, asset: string) =>
  `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${asset}`;

export const computeHealthAfterRepayment = (
  currentHealthFactor: number,
  outstandingDebt: number,
  repaymentAmount: number,
) => {
  const appliedRepayment = Math.min(
    Math.max(repaymentAmount, 0),
    outstandingDebt,
  );
  const remainingDebt = Math.max(outstandingDebt - appliedRepayment, 0);

  if (remainingDebt === 0) return Infinity;

  return (currentHealthFactor * outstandingDebt) / remainingDebt;
};

export default function RepayForm({
  onSubmit,
  positions = DEFAULT_POSITIONS,
  initialPositionId,
}: RepayFormProps) {
  const [selectedPositionId, setSelectedPositionId] = useState(
    initialPositionId ?? positions[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const selectedPosition = positions.find(
    (position) => position.id === selectedPositionId,
  );

  const preview = useMemo(() => {
    if (!selectedPosition) {
      return {
        remainingDebt: 0,
        healthFactorAfter: 0,
        isFullRepay: false,
      };
    }

    const remainingDebt = Math.max(
      selectedPosition.outstandingDebt - amount,
      0,
    );
    const healthFactorAfter = computeHealthAfterRepayment(
      selectedPosition.healthFactor,
      selectedPosition.outstandingDebt,
      amount,
    );

    return {
      remainingDebt,
      healthFactorAfter,
      isFullRepay: remainingDebt === 0 && amount > 0,
    };
  }, [amount, selectedPosition]);

  const positionSummaryData = selectedPosition
    ? {
        suppliedFunds: `$${selectedPosition.collateralAmount.toLocaleString()} ${selectedPosition.collateralAsset}`,
        borrowedAmount: `$${preview.remainingDebt.toLocaleString()} ${selectedPosition.asset}`,
        healthFactor: Number.isFinite(preview.healthFactorAfter)
          ? preview.healthFactorAfter
          : 99,
      }
    : null;

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!selectedPosition) {
      nextErrors.position = "Please select an open borrow position";
    }

    if (!amount || amount <= 0) {
      nextErrors.amount = "Enter a repayment amount greater than zero";
    } else if (selectedPosition && amount > selectedPosition.outstandingDebt) {
      nextErrors.amount = `Repayment cannot exceed ${formatAmount(
        selectedPosition.outstandingDebt,
        selectedPosition.asset,
      )}`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePositionChange = (positionId: string) => {
    const nextPosition = positions.find(
      (position) => position.id === positionId,
    );
    setSelectedPositionId(positionId);
    setAmount(0);
    setErrors({});
    setSubmitStatus("idle");
    setSubmitMessage(
      nextPosition ? `Selected ${nextPosition.asset} borrow position.` : "",
    );
  };

  const handleMaxRepayment = () => {
    if (!selectedPosition) return;
    setAmount(selectedPosition.outstandingDebt);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.amount;
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitStatus("idle");
    setSubmitMessage("");

    if (!validate() || !selectedPosition) {
      setSubmitStatus("error");
      setSubmitMessage("Please fix the errors in the form before continuing.");
      return;
    }

    setSubmitStatus("submitting");
    setSubmitMessage("Preparing repayment preview...");

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "borrow",
          data: {
            asset: selectedPosition.asset,
            amount,
            interestRate: selectedPosition.interestRate,
            duration: selectedPosition.duration ?? 30,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Quote preview failed");
      }

      const payload = (await response.json()) as {
        result?: CalculationResult;
      };

      const data: LendingData = {
        asset: selectedPosition.asset,
        amount,
        interestRate: selectedPosition.interestRate,
        duration: selectedPosition.duration,
        collateral: selectedPosition.collateralAsset,
        collateralAmount: selectedPosition.collateralAmount,
        positionId: selectedPosition.id,
        outstandingDebt: selectedPosition.outstandingDebt,
        remainingDebt: preview.remainingDebt,
        healthFactorBefore: selectedPosition.healthFactor,
        healthFactorAfter: preview.healthFactorAfter,
      };

      setSubmitStatus("success");
      setSubmitMessage("Repayment preview ready.");
      onSubmit(data, payload.result ?? null);
    } catch {
      setSubmitStatus("error");
      setSubmitMessage(
        "Unable to prepare repayment preview. Please try again.",
      );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Repay Borrowed Assets
        </h2>
        <p className="text-gray-600 text-sm">
          Choose an open borrow position and preview how repayment changes debt
          and account health.
        </p>
      </div>

      <StatusAnnouncer status={submitStatus} message={submitMessage} type="repay" />

      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        <div>
          <label
            htmlFor="repay-position"
            className="block text-sm font-medium text-gray-700 mb-3"
          >
            Borrow position
          </label>
          <select
            id="repay-position"
            value={selectedPositionId}
            onChange={(event) => handlePositionChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#2600FF] focus:ring-1 focus:ring-[#2600FF]"
            aria-invalid={Boolean(errors.position)}
            aria-describedby={
              errors.position ? "repay-position-error" : undefined
            }
          >
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.asset} debt -{" "}
                {formatAmount(position.outstandingDebt, position.asset)}
              </option>
            ))}
          </select>
          {errors.position && (
            <p
              id="repay-position-error"
              className="text-xs text-red-500 font-medium mt-2"
              role="alert"
            >
              {errors.position}
            </p>
          )}
        </div>

        <div className="relative">
          <AmountInput
            id="repay-amount"
            label="Repayment amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount || 0}
            error={errors.amount}
            helperText={
              selectedPosition
                ? `Outstanding: ${formatAmount(
                    selectedPosition.outstandingDebt,
                    selectedPosition.asset,
                  )}`
                : undefined
            }
            onChange={(val) => {
              setAmount(val);
              if (errors.amount) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.amount;
                  return next;
                });
              }
            }}
            max={selectedPosition?.outstandingDebt}
            onMax={handleMaxRepayment}
          />
          <button
            type="button"
            onClick={handleMaxRepayment}
            disabled={!selectedPosition || selectedPosition.outstandingDebt <= 0}
            className="absolute right-3 top-8 rounded bg-green-50 px-2 py-1 text-xs font-bold text-green-600 transition-colors hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Repay full debt"
          >
            Repay full debt
          </button>
        </div>

        {selectedPosition && (
          <div className="px-1 pt-2">
            <label htmlFor="repay-percentage" className="sr-only">
              Repayment percentage
            </label>
            <input
              id="repay-percentage"
              type="range"
              min="0"
              max="100"
              step="1"
              value={
                selectedPosition.outstandingDebt > 0
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        Math.round(
                          (amount / selectedPosition.outstandingDebt) * 100
                        )
                      )
                    )
                  : 0
              }
              onChange={(e) => {
                const percentage = Number(e.target.value);
                const calculatedAmount =
                  (percentage / 100) * selectedPosition.outstandingDebt;
                setAmount(calculatedAmount);
                if (errors.amount) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.amount;
                    return next;
                  });
                }
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2600FF]"
              aria-valuetext={`${
                selectedPosition.outstandingDebt > 0
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        Math.round(
                          (amount / selectedPosition.outstandingDebt) * 100
                        )
                      )
                    )
                  : 0
              }%`}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {selectedPosition && (
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="text-xs font-bold text-blue-900 mb-3 uppercase tracking-wider">
                Repayment Preview
              </h3>
              {preview.isFullRepay && (
                <span className="mb-3 inline-block rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">
                  Full repayment
                </span>
              )}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Remaining debt</span>
                  <span className="font-semibold text-gray-900">
                    {formatAmount(
                      preview.remainingDebt,
                      selectedPosition.asset,
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Health factor</span>
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-semibold text-gray-900">
                      {Number.isFinite(preview.healthFactorAfter)
                        ? preview.healthFactorAfter.toFixed(2)
                        : "Debt cleared"}
                    </span>
                    <HealthFactorBadge healthFactor={preview.healthFactorAfter} />
                  </div>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2.5">
                  <span className="text-blue-700">Collateral</span>
                  <span className="font-semibold text-gray-900">
                    {formatAmount(
                      selectedPosition.collateralAmount,
                      selectedPosition.collateralAsset,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <PositionSummary data={positionSummaryData} />
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={submitStatus === "submitting"}
        >
          Review Repayment
        </Button>
        <WalletGate fallbackText="Connect wallet to review repayment">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={submitStatus === "loading"}
          >
            Review Repayment
          </Button>
        </WalletGate>
      </form>
    </div>
  );
}
