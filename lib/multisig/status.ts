import { ProposalStatus } from "./types";

export interface ProposalStatusInput {
  status: ProposalStatus;
  expiresAtLedger: number;
}

/**
 * Computes effective status taking into account current ledger height.
 * If currentLedger > expiresAtLedger and stored status is Active or Passed, returns 'Expired'.
 */
export function effectiveStatus(
  proposal: ProposalStatusInput,
  currentLedger: number
): ProposalStatus {
  if (!proposal) return "Expired";

  if (proposal.status === "Active" || proposal.status === "Passed") {
    if (typeof currentLedger === "number" && currentLedger > proposal.expiresAtLedger) {
      return "Expired";
    }
  }

  return proposal.status;
}

export interface StatusDisplayInfo {
  storedStatus: ProposalStatus;
  effectiveStatus: ProposalStatus;
  isOverridden: boolean;
  displayText: string;
}

/**
 * Returns formatted status display info showing stored vs effective status if overridden.
 * e.g. "stored: Active · effective: Expired"
 */
export function getStatusDisplay(
  proposal: ProposalStatusInput,
  currentLedger?: number
): StatusDisplayInfo {
  const eff =
    typeof currentLedger === "number"
      ? effectiveStatus(proposal, currentLedger)
      : proposal.status;

  const isOverridden = eff !== proposal.status;

  return {
    storedStatus: proposal.status,
    effectiveStatus: eff,
    isOverridden,
    displayText: isOverridden
      ? `stored: ${proposal.status} · effective: ${eff}`
      : proposal.status,
  };
}

export interface ExpiryEstimate {
  expiresAtLedger: number;
  currentLedger: number;
  ledgersRemaining: number;
  isExpired: boolean;
  estimatedSecondsRemaining: number;
  formattedEstimate: string; // e.g. "~15m (approx.)" or "Expired"
}

/**
 * Calculates estimated wall-clock time until proposal expiry based on ledger delta.
 * Close time is estimated at ~5s per ledger on Stellar testnet/pubnet.
 * All estimates are labelled approximate.
 */
export function estimateProposalExpiry(
  expiresAtLedger: number,
  currentLedger: number,
  avgCloseTimeSeconds: number = 5
): ExpiryEstimate {
  const ledgersRemaining = expiresAtLedger - currentLedger;
  const isExpired = ledgersRemaining <= 0;
  const estimatedSecondsRemaining = Math.max(0, ledgersRemaining * avgCloseTimeSeconds);

  let formattedEstimate = "Expired";
  if (!isExpired) {
    if (estimatedSecondsRemaining < 60) {
      formattedEstimate = `~${estimatedSecondsRemaining}s (approx.)`;
    } else if (estimatedSecondsRemaining < 3600) {
      const mins = Math.round(estimatedSecondsRemaining / 60);
      formattedEstimate = `~${mins}m (approx.)`;
    } else if (estimatedSecondsRemaining < 86400) {
      const hours = Math.floor(estimatedSecondsRemaining / 3600);
      const mins = Math.round((estimatedSecondsRemaining % 3600) / 60);
      formattedEstimate =
        mins > 0 ? `~${hours}h ${mins}m (approx.)` : `~${hours}h (approx.)`;
    } else {
      const days = Math.floor(estimatedSecondsRemaining / 86400);
      const hours = Math.round((estimatedSecondsRemaining % 86400) / 3600);
      formattedEstimate =
        hours > 0 ? `~${days}d ${hours}h (approx.)` : `~${days}d (approx.)`;
    }
  }

  return {
    expiresAtLedger,
    currentLedger,
    ledgersRemaining,
    isExpired,
    estimatedSecondsRemaining,
    formattedEstimate,
  };
}
