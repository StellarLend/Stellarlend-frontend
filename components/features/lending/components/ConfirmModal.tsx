"use client";

import { useEffect, useRef, useState } from "react";
import { LendingData, CalculationResult } from "@/app/lending/page";
import type { LendingActionType } from "@/lib/lending/types";
import { cn } from "@/lib/utils/cn";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: LendingData;
  calculation: CalculationResult | null;
  type: LendingActionType;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  data,
  calculation,
  type,
}: ConfirmModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubmitStatus("idle");
      setSubmitMessage("");
      setHasAgreed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();

    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));

      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actionLabel =
    type === "lend"
      ? "Lending"
      : type === "borrow"
        ? "Borrowing"
        : type === "withdraw"
          ? "Withdrawal"
          : "Repayment";
  const amountLabel =
    type === "lend"
      ? "Amount to Lend"
      : type === "borrow"
        ? "Amount to Borrow"
        : type === "withdraw"
          ? "Amount to Withdraw"
          : "Amount to Repay";

  const handleConfirm = async () => {
    if (!hasAgreed) return;

    setIsConfirming(true);
    setSubmitStatus("idle");
    setSubmitMessage("");
    try {
      await onConfirm();
      setSubmitStatus("success");
      setSubmitMessage("Transaction confirmed successfully!");
      setTimeout(onClose, 2000);
    } catch (err) {
      setSubmitStatus("error");
      setSubmitMessage("Transaction failed. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })} ${currency}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          ref={dialogRef}
          className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-transaction-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3
              id="confirm-transaction-title"
              className="text-lg font-semibold text-gray-900"
            >
              Confirm {actionLabel} Transaction
            </h3>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
              aria-label="Close modal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {submitMessage && (
            <div
              className={cn(
                "p-3 rounded-lg mb-4 text-sm font-medium",
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

          {/* Transaction Details */}
          <div className="mb-6">
            <div
              className={`rounded-lg p-4 mb-4 ${
                type === "lend" || type === "withdraw"
                  ? "bg-green-50 border border-green-200"
                  : "bg-blue-50 border border-blue-200"
              }`}
            >
              <div className="text-center">
                <div
                  className={`text-2xl font-bold mb-1 ${
                    type === "lend" || type === "withdraw"
                      ? "text-green-700"
                      : "text-blue-700"
                  }`}
                >
                  {formatCurrency(data.amount, data.asset)}
                </div>
                <div
                  className={`text-sm ${
                    type === "lend" || type === "withdraw"
                      ? "text-green-600"
                      : "text-blue-600"
                  }`}
                >
                  {amountLabel}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {type !== "withdraw" && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Interest Rate</span>
                  <span className="font-medium">
                    {data.interestRate.toFixed(1)}%{" "}
                    {type === "lend" ? "APY" : "APR"}
                  </span>
                </div>
              )}

              {(type === "borrow" || type === "repay") && data.duration && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan Duration</span>
                  <span className="font-medium">{data.duration} days</span>
                </div>
              )}

              {(type === "repay" || type === "withdraw") && (
                <>
                  {data.positionId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Position</span>
                      <span className="font-medium">{data.positionId}</span>
                    </div>
                  )}
                  {typeof data.remainingDebt === "number" && (
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">
                        {type === "withdraw" ? "Remaining Supplied" : "Remaining Debt"}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(data.remainingDebt, data.asset)}
                      </span>
                    </div>
                  )}
                  {typeof data.healthFactorAfter === "number" &&
                    (data.outstandingDebt ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">New Health Factor</span>
                        <span className={cn(
                          "font-medium",
                          type === "withdraw" && data.healthFactorAfter < 1
                            ? "text-red-600"
                            : type === "withdraw" && data.healthFactorAfter < 2
                              ? "text-amber-600"
                              : "text-green-600",
                        )}>
                          {Number.isFinite(data.healthFactorAfter)
                            ? data.healthFactorAfter.toFixed(2)
                            : type === "withdraw"
                              ? "N/A"
                              : "Debt cleared"}
                        </span>
                      </div>
                    )}
                </>
              )}

              {calculation && type !== "repay" && (
                <>
                  {type === "lend" ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Daily Earnings</span>
                        <span className="font-medium text-green-600">
                          +
                          {formatCurrency(
                            calculation.dailyEarnings,
                            data.asset,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-medium">
                          Total Expected Return
                        </span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(
                            data.amount + calculation.totalEarnings,
                            data.asset,
                          )}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {calculation.monthlyPayment && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Monthly Payment</span>
                          <span className="font-medium text-blue-600">
                            {formatCurrency(
                              calculation.monthlyPayment,
                              data.asset,
                            )}
                          </span>
                        </div>
                      )}
                      {calculation.totalRepayment && (
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-medium">Total Repayment</span>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(
                              calculation.totalRepayment,
                              data.asset,
                            )}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Collateral Info for Borrowing / Repay */}
            {(type === "borrow" || type === "repay") &&
              data.collateral &&
              data.collateralAmount && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">
                    {type === "repay"
                      ? "Collateral Securing Position"
                      : "Collateral Required"}
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-700">Asset & Amount</span>
                    <span className="font-medium">
                      {formatCurrency(data.collateralAmount, data.collateral)}
                    </span>
                  </div>
                </div>
              )}
          </div>

          {/* Withdraw Health Warning */}
          {type === "withdraw" &&
            typeof data.healthFactorAfter === "number" &&
            (data.outstandingDebt ?? 0) > 0 &&
            data.healthFactorAfter < 2 && (
              <div
                className={cn(
                  "rounded-xl border p-4 text-sm mb-6",
                  data.healthFactorAfter < 1
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50",
                )}
                role="alert"
                aria-live="assertive"
              >
                <p
                  className={cn(
                    "font-bold mb-1",
                    data.healthFactorAfter < 1
                      ? "text-red-700"
                      : "text-amber-700",
                  )}
                >
                  {data.healthFactorAfter < 1
                    ? "Critical Health Risk"
                    : "Health Factor Warning"}
                </p>
                <p
                  className={cn(
                    data.healthFactorAfter < 1
                      ? "text-red-600"
                      : "text-amber-600",
                  )}
                >
                  This withdrawal would lower your health factor to{" "}
                  <strong>{data.healthFactorAfter.toFixed(2)}</strong>
                  {data.healthFactorAfter < 1
                    ? " (Critical). Your position could be liquidated. Reduce the amount or repay some debt first."
                    : " (At Risk). Consider withdrawing less to maintain a safer position."}
                </p>
              </div>
            )}

          {/* Terms Agreement */}
          <div className="mb-6">
            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                I understand and agree to the{" "}
                <button className="text-green-600 hover:text-green-700 underline">
                  terms and conditions
                </button>
                {type === "borrow" && (
                  <span>
                    {" "}
                    and acknowledge that my collateral may be liquidated if I
                    fail to repay the loan
                  </span>
                )}
                .
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              disabled={isConfirming}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasAgreed || isConfirming}
              className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-all duration-200 ${
                hasAgreed && !isConfirming
                  ? type === "lend" || type === "repay" || type === "withdraw"
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {isConfirming ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </div>
              ) : (
                `Confirm ${actionLabel}`
              )}
            </button>
          </div>

          {/* Security Notice */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <p className="text-xs text-gray-600">
                This transaction will be recorded on the Stellar blockchain and
                cannot be reversed once confirmed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
