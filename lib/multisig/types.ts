export type ProposalStatus =
  | 'Active'
  | 'Passed'
  | 'Executed'
  | 'Cancelled'
  | 'Expired';

export interface Proposal {
  id: number;
  proposer: string;
  action: string | Record<string, any>;
  status: ProposalStatus;
  payloadHash: string;
  approvals: string[];
  signerSetHash: string;
  expiresAtLedger: number;
  threshold?: number;
  totalSigners?: number;
  nonce?: number | string;
  proposalSignerSetHash?: string;
  currentSignerSetHash?: string;
  signerSetChanged?: boolean;
  effectiveStatus?: ProposalStatus;
  decodedAction?: any;
  timeToExpiry?: string;
}

export type MultisigActionStatus =
  | 'idle'
  | 'checking_role'
  | 'simulating'
  | 'verifying_binding'
  | 'awaiting_signature'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'failed';

export const MULTISIG_ERROR_MESSAGES: Record<string, string> = {
  AlreadyApproved: "Connected wallet has already approved this proposal.",
  ProposalExpired: "Proposal has expired and can no longer be approved or executed.",
  SignerSetChanged: "Signer set has changed since proposal creation: pending approvals are invalidated.",
  PayloadHashMismatch: "Payload hash mismatch: proposal action does not match expected payload hash.",
  QuorumNotReached: "Quorum not reached: proposal requires more signer approvals before execution.",
  AlreadyExecuted: "Proposal has already been executed.",
  AlreadyCancelled: "Proposal has already been cancelled.",
  Unauthorized: "Connected address is not an authorized signer for this multisig.",
  ProposalNotFound: "Proposal not found.",
  BatchSizeExceeded: "Batch size exceeded: maximum 32 proposals per batch execution.",
  DuplicateProposalId: "Duplicate proposal ID in batch execution.",
};

export function parseMultisigError(error: unknown): string {
  if (!error) return "Unknown error occurred.";
  const errStr = typeof error === 'string' ? error : (error as any).message || String(error);

  for (const [key, msg] of Object.entries(MULTISIG_ERROR_MESSAGES)) {
    if (errStr.includes(key)) {
      return msg;
    }
  }

  // Contract error numeric codes (e.g. Error(Contract, #6))
  const match = errStr.match(/Error\(Contract, #([0-9]+)\)/);
  if (match) {
    const code = parseInt(match[1], 10);
    const codeMap: Record<number, string> = {
      1: MULTISIG_ERROR_MESSAGES.Unauthorized,
      2: MULTISIG_ERROR_MESSAGES.ProposalNotFound,
      4: MULTISIG_ERROR_MESSAGES.ProposalExpired,
      5: MULTISIG_ERROR_MESSAGES.AlreadyExecuted,
      6: MULTISIG_ERROR_MESSAGES.AlreadyApproved,
      7: MULTISIG_ERROR_MESSAGES.PayloadHashMismatch,
      8: MULTISIG_ERROR_MESSAGES.QuorumNotReached,
      12: MULTISIG_ERROR_MESSAGES.AlreadyCancelled,
      14: MULTISIG_ERROR_MESSAGES.BatchSizeExceeded,
      15: MULTISIG_ERROR_MESSAGES.DuplicateProposalId,
      18: MULTISIG_ERROR_MESSAGES.SignerSetChanged,
    };
    if (codeMap[code]) {
      return codeMap[code];
    }
  }

  return errStr;
}
