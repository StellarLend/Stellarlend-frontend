/**
 * CommitmentDetailActions component
 * Implements bounded action state machine with authorization and telemetry
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  Commitment,
  CommitmentActionType,
  ActionState,
  ActionAuthorization,
  TelemetryEvent,
  CommitmentActionResponse,
} from "@/types/commitment";
import { COMMITMENT_STATE_MACHINE, COMMITMENT_BOUNDS } from "@/types/commitment";

interface CommitmentDetailActionsProps {
  commitment: Commitment;
  canPerformActions: Record<CommitmentActionType, ActionAuthorization>;
  onActionComplete?: (action: CommitmentActionType, newStatus: string) => void;
  onTelemetry?: (event: TelemetryEvent) => void;
}

/**
 * Action button states based on commitment status and authorization
 * Follows explicit state machine transitions defined in COMMITMENT_STATE_MACHINE
 */
export default function CommitmentDetailActions({
  commitment,
  canPerformActions,
  onActionComplete,
  onTelemetry,
}: CommitmentDetailActionsProps) {
  const [actionStates, setActionStates] = useState<Record<CommitmentActionType, ActionState>>({
    fund: "idle",
    dispute: "idle",
    early_exit: "idle",
    settle: "idle",
  });

  const [actionErrors, setActionErrors] = useState<
    Partial<Record<CommitmentActionType, string>>
  >({});

  // Emit telemetry event
  const emitTelemetry = useCallback(
    (event: Omit<TelemetryEvent, "timestamp" | "commitmentId">) => {
      if (onTelemetry) {
        onTelemetry({
          ...event,
          timestamp: Date.now(),
          commitmentId: commitment.id,
        });
      }
    },
    [commitment.id, onTelemetry],
  );

  // Get allowed actions based on current commitment status
  const allowedActions = useMemo(
    () => COMMITMENT_STATE_MACHINE[commitment.status] || [],
    [commitment.status],
  );

  // Check if an action is available (allowed by state machine and authorized)
  const isActionAvailable = useCallback(
    (action: CommitmentActionType): boolean => {
      return allowedActions.includes(action) && canPerformActions[action]?.allowed === true;
    },
    [allowedActions, canPerformActions],
  );

  // Execute action with timeout and error handling
  const executeAction = useCallback(
    async (action: CommitmentActionType) => {
      // Pre-flight checks
      if (!isActionAvailable(action)) {
        const reason = canPerformActions[action]?.reason || "Action not allowed in current state";
        setActionErrors((prev) => ({ ...prev, [action]: reason }));
        emitTelemetry({
          type: "action_failed",
          action,
          status: commitment.status,
          errorType: "authorization_failed",
          errorMessage: reason,
        });
        return;
      }

      // Prevent concurrent execution of same action
      if (actionStates[action] === "loading") {
        return;
      }

      const startTime = Date.now();

      setActionStates((prev) => ({ ...prev, [action]: "loading" }));
      setActionErrors((prev) => {
        const next = { ...prev };
        delete next[action];
        return next;
      });

      emitTelemetry({
        type: "action_initiated",
        action,
        status: commitment.status,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, COMMITMENT_BOUNDS.REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`/api/commitments/${commitment.id}/actions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            commitmentId: commitment.id,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const latency = Date.now() - startTime;
        emitTelemetry({
          type: "api_latency",
          action,
          latencyMs: latency,
        });

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("Rate limited. Please try again later.");
          }
          if (response.status === 403) {
            throw new Error("Not authorized to perform this action.");
          }
          if (response.status === 409) {
            throw new Error("Action conflicts with current commitment state.");
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: CommitmentActionResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Action failed");
        }

        setActionStates((prev) => ({ ...prev, [action]: "success" }));

        emitTelemetry({
          type: "action_completed",
          action,
          status: data.newStatus,
          latencyMs: Date.now() - startTime,
          metadata: {
            transactionHash: data.transactionHash ? "[PRESENT]" : "[ABSENT]",
          },
        });

        // Track state transition
        if (data.newStatus && data.newStatus !== commitment.status) {
          emitTelemetry({
            type: "state_transition",
            status: data.newStatus as any,
            metadata: {
              previousStatus: commitment.status,
              newStatus: data.newStatus,
              triggeredBy: action,
            },
          });
        }

        // Notify parent component
        if (onActionComplete && data.newStatus) {
          onActionComplete(action, data.newStatus);
        }

        // Reset to idle after success animation
        setTimeout(() => {
          setActionStates((prev) => ({ ...prev, [action]: "idle" }));
        }, 2000);
      } catch (err) {
        const error = err as Error;

        // Sanitize error message (remove potential secrets)
        const sanitizedMessage = error.message.replace(/[a-f0-9]{64}/gi, "[REDACTED]");

        setActionStates((prev) => ({ ...prev, [action]: "error" }));
        setActionErrors((prev) => ({ ...prev, [action]: sanitizedMessage }));

        emitTelemetry({
          type: "action_failed",
          action,
          status: commitment.status,
          errorType: error.name,
          errorMessage: sanitizedMessage,
          latencyMs: Date.now() - startTime,
        });

        // Reset to idle after error display
        setTimeout(() => {
          setActionStates((prev) => ({ ...prev, [action]: "idle" }));
        }, 3000);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [
      commitment.id,
      commitment.status,
      isActionAvailable,
      canPerformActions,
      actionStates,
      emitTelemetry,
      onActionComplete,
    ],
  );

  // Action button configurations
  const actionConfig: Record<
    CommitmentActionType,
    {
      label: string;
      description: string;
      variant: "primary" | "secondary" | "danger" | "warning";
      icon?: string;
    }
  > = {
    fund: {
      label: "Fund Commitment",
      description: "Transfer funds to activate this commitment",
      variant: "primary",
      icon: "💰",
    },
    dispute: {
      label: "Raise Dispute",
      description: "Challenge the terms or execution of this commitment",
      variant: "warning",
      icon: "⚠️",
    },
    early_exit: {
      label: "Request Early Exit",
      description: "Exit this commitment before maturity (may incur penalties)",
      variant: "secondary",
      icon: "🚪",
    },
    settle: {
      label: "Settle Commitment",
      description: "Complete this commitment and release collateral",
      variant: "primary",
      icon: "✅",
    },
  };

  // Render action button
  const renderActionButton = (action: CommitmentActionType) => {
    const config = actionConfig[action];
    const state = actionStates[action];
    const error = actionErrors[action];
    const isAvailable = isActionAvailable(action);
    const isAllowed = allowedActions.includes(action);
    const authorization = canPerformActions[action];

    if (!isAllowed) {
      return null; // Don't show buttons for actions not allowed by state machine
    }

    const baseClasses =
      "relative rounded-lg px-6 py-3 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

    const variantClasses = {
      primary: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500",
      secondary: "bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500",
      danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
      warning: "bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500",
    };

    const disabledClasses = "opacity-50 cursor-not-allowed bg-slate-300 text-slate-500";

    const isDisabled = !isAvailable || state === "loading";

    return (
      <div key={action} className="space-y-2">
        <button
          type="button"
          onClick={() => executeAction(action)}
          disabled={isDisabled}
          className={`${baseClasses} ${
            isDisabled ? disabledClasses : variantClasses[config.variant]
          } w-full`}
          aria-label={
            state === "loading"
              ? `Processing ${config.label}`
              : state === "success"
                ? `${config.label} completed`
                : config.label
          }
          aria-describedby={error ? `${action}-error` : `${action}-desc`}
          aria-busy={state === "loading"}
        >
          <span className="flex items-center justify-center gap-2">
            {state === "loading" && (
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
            )}
            {state === "success" && <span aria-hidden="true">✓</span>}
            {state === "error" && <span aria-hidden="true">✗</span>}
            <span>{config.icon}</span>
            <span>
              {state === "loading"
                ? "Processing..."
                : state === "success"
                  ? "Success!"
                  : config.label}
            </span>
          </span>
        </button>

        <p id={`${action}-desc`} className="text-xs text-slate-600">
          {config.description}
        </p>

        {!isAvailable && authorization && !authorization.allowed && (
          <p className="text-xs text-amber-700 font-medium" role="alert">
            ⓘ {authorization.reason}
          </p>
        )}

        {error && (
          <p
            id={`${action}-error`}
            className="text-xs text-red-700 font-medium"
            role="alert"
            aria-live="polite"
          >
            Error: {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Available Actions</h3>

        {allowedActions.length === 0 ? (
          <div className="rounded-md bg-slate-50 p-4 text-center">
            <p className="text-sm text-slate-600">
              No actions available for commitment status: <strong>{commitment.status}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(["fund", "dispute", "early_exit", "settle"] as CommitmentActionType[]).map(
              (action) => renderActionButton(action),
            )}
          </div>
        )}
      </div>

      {/* Status information */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">Current Status</h4>
        <p className="text-sm text-slate-600">
          Status: <span className="font-mono font-semibold">{commitment.status}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Last updated: {new Date(commitment.updatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
