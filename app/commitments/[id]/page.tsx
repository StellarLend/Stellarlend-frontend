/**
 * Commitment detail page with bounded polling and action state machine
 * Implements real-time status tracking with proper cleanup
 */

"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CommitmentDetailActions from "@/components/CommitmentDetailActions";
import CommitmentDiagnostics from "@/components/CommitmentDiagnostics";
import { useCommitmentPolling } from "@/hooks/useCommitmentPolling";
import type {
  CommitmentActionType,
  ActionAuthorization,
  TelemetryEvent,
} from "@/types/commitment";
import { Skeleton } from "@/components/shared/common/Skeleton";
import { PageHeader } from "@/components/shared/common";

interface CommitmentDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Format currency values
 */
function formatCurrency(amount: number, asset: string): string {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })} ${asset}`;
}

/**
 * Format date
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get status badge styling
 */
function getStatusBadgeClass(status: string): string {
  const baseClasses = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";

  const statusClasses: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    active: "bg-emerald-100 text-emerald-800",
    disputed: "bg-red-100 text-red-800",
    early_exit: "bg-blue-100 text-blue-800",
    settled: "bg-slate-100 text-slate-800",
    defaulted: "bg-red-100 text-red-800",
    cancelled: "bg-slate-100 text-slate-800",
  };

  return `${baseClasses} ${statusClasses[status] || "bg-slate-100 text-slate-800"}`;
}

export default function CommitmentDetailPage({ params }: CommitmentDetailPageProps) {
  const resolvedParams = use(params);
  const commitmentId = resolvedParams.id;
  const router = useRouter();

  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const telemetryBufferRef = useRef<TelemetryEvent[]>([]);

  // Mock authorization data - in production, fetch from API
  const [canPerformActions, setCanPerformActions] = useState<
    Record<CommitmentActionType, ActionAuthorization>
  >({
    fund: { allowed: true },
    dispute: { allowed: true },
    early_exit: { allowed: true },
    settle: { allowed: true },
  });

  // Handle telemetry events
  const handleTelemetry = useCallback((event: TelemetryEvent) => {
    telemetryBufferRef.current.push(event);

    // Update state for display (debounced)
    setTelemetryEvents((prev) => [...prev.slice(-49), event]); // Keep last 50 events

    // In production, batch and send to monitoring service
    if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
      // Example: Send to analytics/monitoring
      // analytics.track(event);
    }
  }, []);

  // Use polling hook with telemetry
  const { commitment, isLoading, error, refetch, stopPolling } = useCommitmentPolling({
    commitmentId,
    enabled: true,
    onTelemetry: handleTelemetry,
  });

  // Handle action completion - refetch commitment data
  const handleActionComplete = useCallback(
    (action: CommitmentActionType, newStatus: string) => {
      // Immediately refetch to get updated state
      refetch();

      // Update authorization based on new status (in production, fetch from API)
      // This is a simplified mock - real implementation should fetch permissions
      if (newStatus === "settled" || newStatus === "defaulted" || newStatus === "cancelled") {
        setCanPerformActions({
          fund: { allowed: false, reason: "Commitment is finalized" },
          dispute: { allowed: false, reason: "Commitment is finalized" },
          early_exit: { allowed: false, reason: "Commitment is finalized" },
          settle: { allowed: false, reason: "Commitment is finalized" },
        });
      }
    },
    [refetch],
  );

  // Cleanup on route change or unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Loading state
  if (isLoading && !commitment) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
            <div>
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !commitment) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900">Error Loading Commitment</h2>
            <p className="mt-2 text-sm text-red-700">{error.message}</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => router.push("/commitments")}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Back to Commitments
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!commitment) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(21,163,80,0.24)_0%,rgba(21,163,80,0.1)_38%,rgba(248,250,252,0)_100%)]"
      />

      <div className="relative mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-green-600 via-emerald-500 to-black" />
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <PageHeader
                  tone="light"
                  title={`Commitment ${commitment.id.slice(0, 8)}...`}
                  description="View details and manage this commitment"
                  className="mb-0"
                />
              </div>
              <div>
                <span className={getStatusBadgeClass(commitment.status)}>
                  {commitment.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Real-time update indicator */}
            {isLoading && commitment && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span>Updating...</span>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Commitment Details */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Commitment Details</h3>

              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Commitment ID</dt>
                  <dd className="mt-1 font-mono text-sm text-slate-900">{commitment.id}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Status</dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    <span className={getStatusBadgeClass(commitment.status)}>
                      {commitment.status}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Borrower</dt>
                  <dd className="mt-1 font-mono text-sm text-slate-900">
                    {commitment.borrower.slice(0, 8)}...{commitment.borrower.slice(-6)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Lender</dt>
                  <dd className="mt-1 font-mono text-sm text-slate-900">
                    {commitment.lender.slice(0, 8)}...{commitment.lender.slice(-6)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Amount</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(commitment.amount, commitment.asset)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Funded Amount</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(commitment.fundedAmount, commitment.asset)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Interest Rate</dt>
                  <dd className="mt-1 text-sm text-slate-900">{commitment.interestRate}% APR</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Duration</dt>
                  <dd className="mt-1 text-sm text-slate-900">{commitment.duration} days</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Collateral</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(commitment.collateralAmount, commitment.collateralAsset)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Outstanding Debt</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(commitment.outstandingDebt, commitment.asset)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Created</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formatDate(commitment.createdAt)}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-slate-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formatDate(commitment.updatedAt)}</dd>
                </div>

                {commitment.maturityDate && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Maturity Date</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {formatDate(commitment.maturityDate)}
                    </dd>
                  </div>
                )}

                {commitment.transactionHash && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-slate-500">Transaction Hash</dt>
                    <dd className="mt-1 font-mono text-sm text-slate-900">
                      {commitment.transactionHash}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Diagnostics Dashboard */}
            {telemetryEvents.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  Operational Diagnostics
                </h3>
                <CommitmentDiagnostics events={telemetryEvents} />
              </div>
            )}

            {/* Telemetry Debug Panel (development only) */}
            {process.env.NODE_ENV === "development" && telemetryEvents.length > 0 && (
              <details className="rounded-lg border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  Raw Telemetry Events ({telemetryEvents.length})
                </summary>
                <div className="mt-4 max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">Latency</th>
                        <th className="pb-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {telemetryEvents.slice(-20).map((event, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-1 font-mono">{event.type}</td>
                          <td className="py-1">{event.action || "-"}</td>
                          <td className="py-1">
                            {event.latencyMs ? `${event.latencyMs}ms` : "-"}
                          </td>
                          <td className="py-1">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>

          {/* Actions */}
          <div>
            <CommitmentDetailActions
              commitment={commitment}
              canPerformActions={canPerformActions}
              onActionComplete={handleActionComplete}
              onTelemetry={handleTelemetry}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
