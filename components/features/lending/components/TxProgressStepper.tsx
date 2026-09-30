"use client";

import { memo } from "react";
import { cn } from "@/lib/utils/cn";

export type TxProgressState =
  | "building"
  | "submitted"
  | "pending"
  | "confirmed"
  | "failed";

interface TxProgressStepperProps {
  state: TxProgressState;
}

const BASE_STEPS = [
  {
    id: "building",
    label: "Building",
    description: "Preparing transaction",
  },
  {
    id: "submitted",
    label: "Submitted",
    description: "Sent to the network",
  },
  {
    id: "pending",
    label: "Pending",
    description: "Waiting for settlement",
  },
] as const;

const ANNOUNCEMENTS: Record<TxProgressState, string> = {
  building: "Building transaction.",
  submitted: "Transaction submitted to the network.",
  pending: "Transaction pending on-chain.",
  confirmed: "Transaction confirmed on-chain.",
  failed: "Transaction failed.",
};

const STATE_INDEX: Record<TxProgressState, number> = {
  building: 0,
  submitted: 1,
  pending: 2,
  confirmed: 3,
  failed: 3,
};

/**
 * Presentation-only transaction progress. Polling remains owned by the page's
 * single useTxStatus instance; this component only renders its mapped state.
 */
export function TxProgressStepper({ state }: TxProgressStepperProps) {
  const terminalStep =
    state === "failed"
      ? {
          id: "failed" as const,
          label: "Failed",
          description: "Transaction did not settle",
        }
      : {
          id: "confirmed" as const,
          label: "Confirmed",
          description: "Settled on-chain",
        };
  const steps = [...BASE_STEPS, terminalStep];
  const currentIndex = STATE_INDEX[state];

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Transaction progress"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Transaction progress
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Keep this page open while the transaction settles.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            state === "failed"
              ? "bg-red-50 text-red-700"
              : state === "confirmed"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-blue-50 text-blue-700",
          )}
        >
          {steps[currentIndex].label}
        </span>
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-2">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFailed = isCurrent && state === "failed";

          return (
            <li
              key={step.id}
              className="relative"
              data-step={step.id}
              data-state={
                isComplete ? "complete" : isCurrent ? "current" : "upcoming"
              }
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex items-center sm:block">
                <div className="flex items-center sm:w-full">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                      isComplete &&
                        "border-emerald-600 bg-emerald-600 text-white",
                      isCurrent &&
                        !isFailed &&
                        "border-blue-600 bg-blue-600 text-white",
                      isFailed && "border-red-600 bg-red-600 text-white",
                      !isComplete &&
                        !isCurrent &&
                        "border-slate-200 bg-white text-slate-400",
                    )}
                  >
                    {isComplete ? "\u2713" : isFailed ? "!" : index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mx-2 hidden h-0.5 flex-1 sm:block",
                        index < currentIndex
                          ? "bg-emerald-600"
                          : "bg-slate-200",
                      )}
                    />
                  )}
                </div>
                <div className="ml-3 sm:ml-0 sm:mt-2 sm:pr-2">
                  <span
                    className={cn(
                      "block text-xs font-semibold",
                      isFailed
                        ? "text-red-700"
                        : isCurrent
                          ? "text-blue-700"
                          : isComplete
                            ? "text-emerald-700"
                            : "text-slate-500",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {step.description}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {ANNOUNCEMENTS[state]}
      </p>
    </section>
  );
}

export default memo(TxProgressStepper);
