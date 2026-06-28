"use client";

import { useMemo, useState } from "react";
import type { LendingData } from "@/lib/lending/types";
import { Input } from "@/components/shared/ui/Input";
import Button from "@/components/shared/ui/Button";
import { WalletGate } from "@/components/shared/ui/WalletGate";
import PositionSummary from "@/components/features/dashboard/components/PositionSummary";
import { cn } from "@/lib/utils/cn";

export interface SupplyPosition {
  id: string;
  asset: string;
  suppliedAmount: number;
  lockedCollateral: number;
  outstandingDebt: number;
  healthFactor: number;
}

interface WithdrawFormProps {
  onSubmit: (data: LendingData) => void;
  positions?: SupplyPosition[];
  initialPositionId?: string;
}

const DEFAULT_POSITIONS: SupplyPosition[] = [
  {
    id: "xlm-supply-001",
    asset: "XLM",
    suppliedAmount: 5000,
    lockedCollateral: 2250,
    outstandingDebt: 1500,
    healthFactor: 1.85,
  },
  {
    id: "usdc-supply-002",
    asset: "USDC",
    suppliedAmount: 3000,
    lockedCollateral: 0,
    outstandingDebt: 0,
    healthFactor: 99,
  },
];

const AT_RISK_THRESHOLD = 2.0;
const CRITICAL_THRESHOLD = 1.0;

const formatAmount = (amount: number, asset: string) =>
  `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${asset}`;

const getHealthLabel = (healthFactor: number, hasDebt: boolean) => {
  if (!hasDebt) return "N/A";
  if (healthFactor >= AT_RISK_THRESHOLD) return "Healthy";
  if (healthFactor >= CRITICAL_THRESHOLD) return "At Risk";
  return "Critical";
};

export function computeWithdrawHealthFactor(
  currentHealthFactor: number,
  suppliedAmount: number,
  withdrawAmount: number,
  outstandingDebt: number,
): number {
  if (outstandingDebt <= 0) return currentHealthFactor;
  if (suppliedAmount <= 0) return 0;
  const remaining = suppliedAmount - withdrawAmount;
  if (remaining <= 0) return 0;
  return (currentHealthFactor * remaining) / suppliedAmount;
}

export default function WithdrawForm({
  onSubmit,
  positions = DEFAULT_POSITIONS,
  initialPositionId,
}: WithdrawFormProps) {
  const [selectedPositionId, setSelectedPositionId] = useState(
    initialPositionId ?? positions[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const selectedPosition = positions.find((p) => p.id === selectedPositionId);
  const withdrawableBalance = selectedPosition
    ? Math.max(0, selectedPosition.suppliedAmount - selectedPosition.lockedCollateral)
    : 0;

  const preview = useMemo(() => {
    if (!selectedPosition) {
      return { remainingSupplied: 0, healthFactorAfter: 0, label: "Unavailable" };
    }

    const remainingSupplied = Math.max(
      selectedPosition.suppliedAmount - amount,
      0,
    );
    const healthFactorAfter = computeWithdrawHealthFactor(
      selectedPosition.healthFactor,
      selectedPosition.suppliedAmount,
      amount,
      selectedPosition.outstandingDebt,
    );
    const hasDebt = selectedPosition.outstandingDebt > 0;

    return {
      remainingSupplied,
      healthFactorAfter,
      label: getHealthLabel(healthFactorAfter, hasDebt),
    };
  }, [amount, selectedPosition]);

  const hasDebt = (selectedPosition?.outstandingDebt ?? 0) > 0;
  const isHealthCritical =
    hasDebt && amount > 0 && preview.healthFactorAfter < CRITICAL_THRESHOLD;
  const isHealthAtRisk =
    hasDebt &&
    amount > 0 &&
    preview.healthFactorAfter >= CRITICAL_THRESHOLD &&
    preview.healthFactorAfter < AT_RISK_THRESHOLD;

  const positionSummaryData = selectedPosition
    ? {
        suppliedFunds: `$${preview.remainingSupplied.toLocaleString()} ${selectedPosition.asset}`,
        borrowedAmount: `$${selectedPosition.outstandingDebt.toLocaleString()} ${selectedPosition.asset}`,
        healthFactor: Number.isFinite(preview.healthFactorAfter)
          ? preview.healthFactorAfter
          : 99,
      }
    : null;

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!selectedPosition) {
      nextErrors.position = "Please select a supply position";
    }

    if (!amount || amount <= 0) {
      nextErrors.amount = "Enter a withdrawal amount greater than zero";
    } else if (selectedPosition && amount > withdrawableBalance) {
      nextErrors.amount = `Amount exceeds withdrawable balance of ${formatAmount(
        withdrawableBalance,
        selectedPosition.asset,
      )}`;
    } else if (isHealthCritical) {
      nextErrors.amount =
        "This withdrawal would push your health factor into the critical zone. Reduce the amount to protect your position.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePositionChange = (positionId: string) => {
    setSelectedPositionId(positionId);
    setAmount(0);
    setErrors({});
    setSubmitStatus("idle");
    setSubmitMessage("");
  };

  const handleMaxWithdraw = () => {
    if (!selectedPosition) return;
    setAmount(withdrawableBalance);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.amount;
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitStatus("idle");
    setSubmitMessage("");

    if (!validate() || !selectedPosition) {
      setSubmitStatus("error");
      setSubmitMessage("Please fix the errors in the form before continuing.");
      return;
    }

    const data: LendingData = {
      asset: selectedPosition.asset,
      amount,
      interestRate: 0,
      positionId: selectedPosition.id,
      outstandingDebt: selectedPosition.outstandingDebt,
      remainingDebt: preview.remainingSupplied,
      collateralAmount: selectedPosition.lockedCollateral,
      healthFactorBefore: selectedPosition.healthFactor,
      healthFactorAfter: preview.healthFactorAfter,
    };

    setSubmitStatus("success");
    setSubmitMessage("Withdrawal preview ready.");
    onSubmit(data);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Withdraw Supplied Assets
        </h2>
        <p className="text-gray-600 text-sm">
          Redeem available supplied liquidity. Funds locked as collateral for
          open borrows cannot be withdrawn.
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
        <div>
          <label
            htmlFor="withdraw-position"
            className="block text-sm font-medium text-gray-700 mb-3"
          >
            Supply position
          </label>
          <select
            id="withdraw-position"
            value={selectedPositionId}
            onChange={(e) => handlePositionChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#2600FF] focus:ring-1 focus:ring-[#2600FF]"
            aria-invalid={Boolean(errors.position)}
            aria-describedby={
              errors.position ? "withdraw-position-error" : undefined
            }
          >
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.asset} supply —{" "}
                {formatAmount(position.suppliedAmount, position.asset)}
              </option>
            ))}
          </select>
          {errors.position && (
            <p
              id="withdraw-position-error"
              className="text-xs text-red-500 font-medium mt-2"
              role="alert"
            >
              {errors.position}
            </p>
          )}
        </div>

        {selectedPosition && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total supplied</span>
              <span className="font-semibold text-gray-900">
                {formatAmount(selectedPosition.suppliedAmount, selectedPosition.asset)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Locked as collateral</span>
              <span className="font-semibold text-orange-600">
                {formatAmount(selectedPosition.lockedCollateral, selectedPosition.asset)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="text-gray-700 font-medium">
                Available to withdraw
              </span>
              <span className="font-bold text-green-600">
                {formatAmount(withdrawableBalance, selectedPosition.asset)}
              </span>
            </div>
          </div>
        )}

        <div className="relative">
          <Input
            id="withdraw-amount"
            label="Withdrawal amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount || ""}
            error={errors.amount}
            helperText={
              selectedPosition
                ? `Available: ${formatAmount(withdrawableBalance, selectedPosition.asset)}`
                : undefined
            }
            onChange={(e) => {
              const target = e.target as HTMLInputElement;
              setAmount(Number.parseFloat(target.value) || 0);
              if (errors.amount) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.amount;
                  return next;
                });
              }
            }}
          />
          <button
            type="button"
            onClick={handleMaxWithdraw}
            className="absolute right-3 top-8 rounded bg-green-50 px-2 py-1 text-xs font-bold text-green-600 transition-colors hover:text-green-700"
          >
            MAX
          </button>
        </div>

        {hasDebt && amount > 0 && isHealthCritical && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm"
            role="alert"
            aria-live="assertive"
          >
            <p className="font-bold text-red-700 mb-1">Critical Health Risk</p>
            <p className="text-red-600">
              This withdrawal would lower your health factor to{" "}
              <strong>{preview.healthFactorAfter.toFixed(2)}</strong> (Critical).
              Your position could be liquidated. Reduce the amount or repay some
              debt first.
            </p>
          </div>
        )}

        {hasDebt && amount > 0 && isHealthAtRisk && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
            role="alert"
            aria-live="polite"
          >
            <p className="font-bold text-amber-700 mb-1">
              Health Factor Warning
            </p>
            <p className="text-amber-600">
              This withdrawal would lower your health factor to{" "}
              <strong>{preview.healthFactorAfter.toFixed(2)}</strong> (At Risk).
              Consider withdrawing less to maintain a safer position.
            </p>
          </div>
        )}

        {selectedPosition && (
          <div className="space-y-5">
            <div className="rounded-xl border border-green-100 bg-green-50 p-5">
              <h3 className="text-xs font-bold text-green-900 mb-3 uppercase tracking-wider">
                Withdrawal Preview
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700">Remaining supplied</span>
                  <span className="font-semibold text-gray-900">
                    {formatAmount(
                      preview.remainingSupplied,
                      selectedPosition.asset,
                    )}
                  </span>
                </div>
                {hasDebt && (
                  <div className="flex justify-between">
                    <span className="text-green-700">Health factor</span>
                    <span className="font-semibold text-gray-900">
                      {preview.healthFactorAfter.toFixed(2)} ({preview.label})
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-green-200 pt-2.5">
                  <span className="text-green-700">Outstanding debt</span>
                  <span className="font-semibold text-gray-900">
                    {formatAmount(
                      selectedPosition.outstandingDebt,
                      selectedPosition.asset,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <PositionSummary data={positionSummaryData} />
          </div>
        )}

        <WalletGate fallbackText="Connect wallet to review withdrawal">
          <Button
            type="submit"
            variant="success"
            size="lg"
            fullWidth
            isLoading={false}
          >
            Review Withdrawal
          </Button>
        </WalletGate>
      </form>
    </div>
  );
}
