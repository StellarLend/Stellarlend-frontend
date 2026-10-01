/**
 * Commitment detail page with bounded polling and action state machine
 * Implements real-time status tracking with proper cleanup
 */

"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type CommitmentStatus =
  | "pending"
  | "active"
  | "disputed"
  | "early_exit"
  | "settled"
  | "defaulted"
  | "cancelled";

interface CommitmentRecord {
  id: string;
  status: CommitmentStatus;
  borrower: string;
  lender: string;
  amount: number;
  asset: string;
  fundedAmount: number;
  collateralAmount: number;
  collateralAsset: string;
  interestRate: number;
  duration: number;
  outstandingDebt: number;
  createdAt: string;
  updatedAt: string;
  maturityDate?: string;
  transactionHash?: string;
  chainId?: string;
}

const ACTION_ALLOWED_STATUSES: Record<CommitmentActionType, CommitmentStatus[]> = {
  fund: ["pending"],
  dispute: ["active", "early_exit"],
  early_exit: ["active"],
  settle: ["active", "early_exit"],
};

const ACTION_TARGET_STATUSES: Record<CommitmentActionType, CommitmentStatus[]> = {
  fund: ["active"],
  dispute: ["disputed"],
  early_exit: ["early_exit"],
  settle: ["settled"],
};

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isFinitePositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isAddress = (value: unknown): value is string =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

const isCommitmentStatus = (value: unknown): value is CommitmentStatus =>
  typeof value === "string" &&
  ["pending", "active", "disputed", "early_exit", "settled", "defaulted", "cancelled"].includes(value);

function isValidCommitment(value: unknown): value is CommitmentRecord {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    isNonEmptyString(c.id) &&
    isCommitmentStatus(c.status) &&
    isAddress(c.borrower) &&
    isAddress(c.lender) &&
    isFinitePositive(c.amount) &&
    isNonEmptyString(c.asset) &&
    isFiniteNonNegative(c.fundedAmount) &&
    isFiniteNonNegative(c.collateralAmount) &&
    isNonEmptyString(c.collateralAsset) &&
    isFiniteNonNegative(c.interestRate) &&
    isFinitePositive(c.duration) &&
    isFiniteNonNegative(c.outstandingDebt) &&
    isNonEmptyString(c.createdAt) &&
    !Number.isNaN(Date.parse(c.createdAt)) &&
    isNonEmptyString(c.updatedAt) &&
    !Number.isNaN(Date.parse(c.updatedAt)) &&
    (c.maturityDate === undefined ||
      (isNonEmptyString(c.maturityDate) && !Number.isNaN(Date.parse(c.maturityDate)))) &&
    (c.transactionHash === undefined || isNonEmptyString(c.transactionHash)) &&
    (c.chainId === undefined || isNonEmptyString(c.chainId))
  );
}

const getEthereumProvider = (): EthereumProvider | null => {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null;
};

const isSameAddress = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

function authorizeAction(
  commitment: CommitmentRecord,
  connectedAddress: string | null,
  connectedChainId: string | null,
  action: CommitmentActionType,
): ActionAuthorization {
  if (!connectedAddress) {
    return { allowed: false, reason: "Connect your wallet to continue." };
  }

  if (
    connectedChainId &&
    commitment.chainId &&
    !isSameAddress(connectedChainId, commitment.chainId)
  ) {
    return { allowed: false, reason: "Connected wallet is on the wrong network." };
  }

  const isParticipant =
    isSameAddress(connectedAddress, commitment.borrower) ||
    isSameAddress(connectedAddress, commitment.lender);

  if (!isParticipant) {
    return { allowed: false, reason: "Connected wallet is not a participant on this commitment." };
  }

  if (!ACTION_ALLOWED_STATUSES[action].includes(commitment.status)) {
    return {
      allowed: false,
      reason: `Action is not available while the commitment is ${commitment.status}.`,
    };
  }

  if (action === "fund" && !isSameAddress(connectedAddress, commitment.lender)) {
    return { allowed: false, reason: "Only the lender can fund this commitment." };
  }

  if (action === "settle" && !isSameAddress(connectedAddress, commitment.borrower)) {
    return { allowed: false, reason: "Only the borrower can settle this commitment." };
  }

  if (action === "early_exit" && !isSameAddress(connectedAddress, commitment.lender)) {
    return { allowed: false, reason: "Only the lender can request an early exit." };
  }

  return { allowed: true };
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
  const commitmentId =
    typeof resolvedParams.id === "string" ? resolvedParams.id.trim() : "";
  const router = useRouter();

  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const telemetryBufferRef = useRef<TelemetryEvent[]>([]);

  const isRouteParamValid = useMemo(
    () => /^0x[a-fA-F0-9]{64}$/.test(commitmentId),
    [commitmentId],
  );

  const [wallet, setWallet] = useState<{ address: string | null; chainId: string | null }>({
    address: null,
    chainId: null,
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
    enabled: isRouteParamValid,
    onTelemetry: handleTelemetry,
  });

  // Handle action completion - refetch commitment data after re-checking authorization
  const handleActionComplete = useCallback(
    (action: CommitmentActionType, newStatus: string) => {
      if (!isValidCommitment(commitment)) return;

      const targetStatuses = ACTION_TARGET_STATUSES[action];
      if (!targetStatuses) return;

      const authorization = authorizeAction(commitment, wallet.address, wallet.chainId, action);

      if (
        !authorization.allowed ||
        !targetStatuses.includes(newStatus as CommitmentStatus)
      ) {
        return;
      }

      refetch();
    },
    [commitment, wallet.address, wallet.chainId, refetch],
  );

  const isCommitmentPayloadValid = useMemo(
    () => isValidCommitment(commitment),
    [commitment],
  );

  const canPerformActions = useMemo<Record<CommitmentActionType, ActionAuthorization>>(() => {
    if (!commitment || !isValidCommitment(commitment)) {
      return {
        fund: { allowed: false, reason: "Commitment data is unavailable or invalid." },
        dispute: { allowed: false, reason: "Commitment data is unavailable or invalid." },
        early_exit: { allowed: false, reason: "Commitment data is unavailable or invalid." },
        settle: { allowed: false, reason: "Commitment data is unavailable or invalid." },
      };
    }

    return {
      fund: authorizeAction(commitment, wallet.address, wallet.chainId, "fund"),
      dispute: authorizeAction(commitment, wallet.address, wallet.chainId, "dispute"),
      early_exit: authorizeAction(commitment, wallet.address, wallet.chainId, "early_exit"),
      settle: authorizeAction(commitment, wallet.address, wallet.chainId, "settle"),
    };
  }, [commitment, wallet.address, wallet.chainId]);

  useEffect(() => {
    let active = true;
    const provider = getEthereumProvider();

    if (!provider) {
      setWallet({ address: null, chainId: null });
      return;
    }

    const syncWallet = async () => {
      try {
        const [accounts, chainId] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
        ]);

        if (!active) return;

        const accountList = Array.isArray(accounts) ? (accounts as string[]) : [];
        setWallet({
          address: accountList[0]?.toLowerCase() ?? null,
          chainId: typeof chainId === "string" ? chainId.toLowerCase() : null,
        });
      } catch {
        if (active) setWallet({ address: null, chainId: null });
      }
    };

    syncWallet();

    const onAccountsChanged = (accounts: unknown) => {
      const accountList = Array.isArray(accounts) ? (accounts as string[]) : [];
      setWallet((prev) => ({
        ...prev,
        address: accountList[0]?.toLowerCase() ?? null,
      }));
    };

    const onChainChanged = (changedChainId: unknown) => {
      setWallet((prev) => ({
        ...prev,
        chainId: typeof changedChainId === "string" ? changedChainId.toLowerCase() : null,
      }));
    };

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);

    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  // Cleanup on route change or unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  if (!isRouteParamValid) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900">Invalid Commitment ID</h2>
            <p className="mt-2 text-sm text-red-700">The commitment identifier in the URL is malformed.</p>
            <div className="mt-4 flex gap-3">
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

  if (commitment && !isCommitmentPayloadValid) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900">Invalid Commitment Data</h2>
            <p className="mt-2 text-sm text-red-700">
              The commitment response failed validation. Verify the commitment on-chain before proceeding.
            </p>
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
