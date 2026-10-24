import { rpc, xdr, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { config } from "../config";
import { simulateRead, getRpcServer } from "../soroban";
import { decodeProposalAction } from "./decode";
import { effectiveStatus, estimateProposalExpiry } from "./status";
import { Proposal, ProposalStatus } from "./types";

export interface MultisigOverview {
  threshold: number;
  signers: string[];
  signerSetHash: string;
  currentLedger: number;
}

export interface ListProposalsOptions {
  contractId?: string;
  rpcServer?: rpc.Server;
  forceProbing?: boolean;
}

/**
 * Checks whether an error signifies that a proposal ID was not found.
 */
export function isProposalNotFoundError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string" ? err : (err as any).message || String(err);
  return (
    msg.includes("ProposalNotFound") ||
    msg.includes("Error(Contract, #2)") ||
    (msg.includes("#2") && msg.includes("Contract"))
  );
}

/**
 * Retrieves multisig contract overview: threshold, signers list, signer set hash, and latest ledger sequence.
 */
export async function getMultisigOverview(
  contractId: string = config.multisigId,
  rpcServer: rpc.Server = getRpcServer()
): Promise<MultisigOverview | null> {
  if (!contractId) return null;

  try {
    const [thresholdRes, signersRes, signerSetHashRes, latestLedgerRes] =
      await Promise.all([
        simulateRead(contractId, "get_threshold", [], { customRpcServer: rpcServer }),
        simulateRead(contractId, "get_signers", [], { customRpcServer: rpcServer }),
        simulateRead(contractId, "get_signer_set_hash", [], { customRpcServer: rpcServer }),
        rpcServer.getLatestLedger(),
      ]);

    const threshold = Number(thresholdRes.native) || 1;

    let signers: string[] = [];
    if (Array.isArray(signersRes.native)) {
      signers = signersRes.native.map(String);
    }

    let signerSetHash = "";
    if (Buffer.isBuffer(signerSetHashRes.native) || signerSetHashRes.native instanceof Uint8Array) {
      signerSetHash = Buffer.from(signerSetHashRes.native).toString("hex");
    } else if (signerSetHashRes.native) {
      signerSetHash = String(signerSetHashRes.native);
    }

    const currentLedger = latestLedgerRes?.sequence ?? 0;

    return {
      threshold,
      signers,
      signerSetHash,
      currentLedger,
    };
  } catch (err) {
    throw new Error(`Failed to fetch multisig overview: ${String((err as any)?.message || err)}`);
  }
}

/**
 * Helper to normalize raw Soroban proposal struct values.
 */
function normalizeProposal(raw: any, id: number): Proposal {
  let obj = raw;
  if (obj instanceof Map) {
    obj = Object.fromEntries(obj.entries());
  }

  const proposer = obj.proposer ? String(obj.proposer) : "";
  const decodedAction = decodeProposalAction(obj.action);

  let payloadHash = "";
  const rawHash = obj.payload_hash ?? obj.payloadHash;
  if (Buffer.isBuffer(rawHash) || rawHash instanceof Uint8Array) {
    payloadHash = Buffer.from(rawHash).toString("hex");
  } else if (rawHash) {
    payloadHash = String(rawHash);
  }

  const approvals = Array.isArray(obj.approvals) ? obj.approvals.map(String) : [];

  let status: ProposalStatus = "Active";
  const rawStatus = obj.status;
  if (typeof rawStatus === "string" && ["Active", "Passed", "Executed", "Cancelled", "Expired"].includes(rawStatus)) {
    status = rawStatus as ProposalStatus;
  } else if (typeof rawStatus === "object" && rawStatus !== null) {
    const key = Object.keys(rawStatus)[0];
    if (["Active", "Passed", "Executed", "Cancelled", "Expired"].includes(key)) {
      status = key as ProposalStatus;
    }
  }

  const expiresAtLedger =
    obj.expires_at !== undefined
      ? Number(obj.expires_at)
      : obj.expiresAt !== undefined
      ? Number(obj.expiresAt)
      : obj.expiresAtLedger !== undefined
      ? Number(obj.expiresAtLedger)
      : 0;

  return {
    id: obj.id !== undefined ? Number(obj.id) : id,
    proposer,
    action: decodedAction.summary,
    decodedAction,
    status,
    payloadHash,
    approvals,
    signerSetHash: "",
    expiresAtLedger,
  };
}

/**
 * Reads get_proposal(id) from the multisig contract on-chain.
 * Returns null if ProposalNotFound.
 */
export async function getProposal(
  proposalId: number,
  contractId: string = config.multisigId,
  rpcServer: rpc.Server = getRpcServer()
): Promise<Proposal | null> {
  if (!contractId) return null;

  try {
    const res = await simulateRead(
      contractId,
      "get_proposal",
      [xdr.ScVal.scvU32(proposalId)],
      { customRpcServer: rpcServer }
    );

    if (res.native) {
      return normalizeProposal(res.native, proposalId);
    }
    return null;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (isProposalNotFoundError(msg)) {
      return null;
    }
    throw err;
  }
}

/**
 * Reads get_proposal_signer_set_hash(id) from the multisig contract on-chain.
 */
export async function getProposalSignerSetHash(
  proposalId: number,
  contractId: string = config.multisigId,
  rpcServer: rpc.Server = getRpcServer()
): Promise<string | null> {
  if (!contractId) return null;

  try {
    const res = await simulateRead(
      contractId,
      "get_proposal_signer_set_hash",
      [xdr.ScVal.scvU32(proposalId)],
      { customRpcServer: rpcServer }
    );

    if (Buffer.isBuffer(res.native) || res.native instanceof Uint8Array) {
      return Buffer.from(res.native).toString("hex");
    }
    if (res.native) {
      return String(res.native);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads get_proposal_nonce(id) from the multisig contract on-chain.
 */
export async function getProposalNonce(
  proposalId: number,
  contractId: string = config.multisigId,
  rpcServer: rpc.Server = getRpcServer()
): Promise<string | number | null> {
  if (!contractId) return null;

  try {
    const res = await simulateRead(
      contractId,
      "get_proposal_nonce",
      [xdr.ScVal.scvU32(proposalId)],
      { customRpcServer: rpcServer }
    );

    if (res.native !== null && res.native !== undefined) {
      return typeof res.native === "bigint" ? res.native.toString() : Number(res.native);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads full proposal detail including signer set comparison, effective status, nonce, and expiry estimates.
 */
export async function getProposalDetail(
  proposalId: number,
  contractId: string = config.multisigId,
  rpcServer: rpc.Server = getRpcServer(),
  knownOverview?: MultisigOverview | null
): Promise<Proposal | null> {
  if (!contractId) return null;

  const [prop, proposalSignerSetHash, nonce, overview] = await Promise.all([
    getProposal(proposalId, contractId, rpcServer),
    getProposalSignerSetHash(proposalId, contractId, rpcServer),
    getProposalNonce(proposalId, contractId, rpcServer),
    knownOverview ? Promise.resolve(knownOverview) : getMultisigOverview(contractId, rpcServer),
  ]);

  if (!prop) return null;

  const currentSignerSetHash = overview?.signerSetHash || "";
  const currentLedger = overview?.currentLedger || 0;

  const signerSetChanged = Boolean(
    proposalSignerSetHash &&
      currentSignerSetHash &&
      proposalSignerSetHash.toLowerCase() !== currentSignerSetHash.toLowerCase()
  );

  const effStatus = effectiveStatus(prop, currentLedger);
  const expiry = estimateProposalExpiry(prop.expiresAtLedger, currentLedger);

  return {
    ...prop,
    threshold: overview?.threshold || 1,
    totalSigners: overview?.signers?.length || 1,
    proposalSignerSetHash: proposalSignerSetHash || "",
    currentSignerSetHash,
    signerSetHash: proposalSignerSetHash || currentSignerSetHash,
    signerSetChanged,
    nonce: nonce ?? undefined,
    effectiveStatus: effStatus,
    timeToExpiry: expiry.formattedEstimate,
  };
}

/**
 * Extracts a proposal ID from a Soroban event topic or value.
 */
export function extractProposalIdFromEvent(event: any): number | null {
  if (!event) return null;

  // 1. Check topic items
  if (Array.isArray(event.topic)) {
    for (const t of event.topic) {
      if (typeof t?.switch === "function" && t.switch() === xdr.ScValType.scvU32()) {
        return t.u32();
      }
      try {
        const native = scValToNative(t);
        if (typeof native === "number" && native > 0) return native;
        if (typeof native === "bigint" && native > 0n) return Number(native);
      } catch {}
    }
  }

  // 2. Check event value
  if (event.value) {
    if (typeof event.value?.switch === "function" && event.value.switch() === xdr.ScValType.scvU32()) {
      return event.value.u32();
    }
    try {
      const native = scValToNative(event.value);
      if (typeof native === "number" && native > 0) return native;
      if (typeof native === "bigint" && native > 0n) return Number(native);
      if (typeof native === "object" && native !== null) {
        const id = (native as any).id ?? (native as any).proposal_id ?? (native as any).proposalId;
        if (typeof id === "number" && id > 0) return id;
        if (typeof id === "bigint" && id > 0n) return Number(id);
      }
    } catch {}
  }

  return null;
}

/**
 * Discovers proposal IDs by fetching ProposalCreatedEvent from Soroban RPC getEvents.
 * Note: RPC getEvents has a limited retention window (~7 days). Older proposals need the probing fallback.
 */
export async function discoverProposalIdsViaEvents(
  contractId: string,
  rpcServer: rpc.Server,
  currentLedger: number
): Promise<number[]> {
  const startLedger = Math.max(1, currentLedger - 10000);
  const res = await rpcServer.getEvents({
    startLedger,
    filters: [
      {
        type: "contract",
        contractIds: [contractId],
        topics: [],
      },
    ],
  });

  const ids = new Set<number>();
  if (res?.events && Array.isArray(res.events)) {
    for (const event of res.events) {
      const id = extractProposalIdFromEvent(event);
      if (id !== null && id > 0) {
        ids.add(id);
      }
    }
  }

  return Array.from(ids).sort((a, b) => a - b);
}

/**
 * Sequential get_proposal probing fallback with bounded concurrency of 4,
 * stopping immediately after the first ProposalNotFound without hammering RPC.
 */
export async function probeProposalIds(
  contractId: string,
  rpcServer: rpc.Server = getRpcServer(),
  concurrency: number = 4
): Promise<number[]> {
  const discoveredIds: number[] = [];
  let startId = 1;
  let stop = false;

  while (!stop) {
    const batchIds: number[] = [];
    for (let i = 0; i < concurrency; i++) {
      batchIds.push(startId + i);
    }

    const results = await Promise.allSettled(
      batchIds.map((id) => getProposal(id, contractId, rpcServer))
    );

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const id = batchIds[i];

      if (res.status === "fulfilled" && res.value !== null) {
        discoveredIds.push(id);
      } else if (res.status === "fulfilled" && res.value === null) {
        // First ProposalNotFound encountered! Stop probing.
        stop = true;
        break;
      } else {
        const reason = (res as PromiseRejectedResult).reason;
        const msg = String(reason?.message || reason || "");
        if (isProposalNotFoundError(msg)) {
          stop = true;
          break;
        } else {
          // RPC or unexpected error; stop probing to prevent hammering
          stop = true;
          break;
        }
      }
    }

    if (discoveredIds.length < startId + concurrency - 1) {
      break;
    }
    startId += concurrency;
  }

  return discoveredIds;
}

/**
 * Lists multisig overview and all proposals.
 * Uses event discovery first; falls back to bounded probing (concurrency 4, stop on first not found).
 */
export async function listProposals(
  options: ListProposalsOptions = {}
): Promise<{ overview: MultisigOverview | null; proposals: Proposal[] }> {
  const contractId = options.contractId || config.multisigId;
  if (!contractId) {
    return { overview: null, proposals: [] };
  }

  const rpcServer = options.rpcServer || getRpcServer();
  const overview = await getMultisigOverview(contractId, rpcServer);
  if (!overview) {
    return { overview: null, proposals: [] };
  }

  let proposalIds: number[] = [];

  if (!options.forceProbing) {
    try {
      proposalIds = await discoverProposalIdsViaEvents(
        contractId,
        rpcServer,
        overview.currentLedger
      );
    } catch {
      // Event discovery failed or unsupported, fall back to probing
      proposalIds = [];
    }
  }

  // If no IDs found via events (e.g. outside retention window or empty), use probing fallback
  if (proposalIds.length === 0) {
    proposalIds = await probeProposalIds(contractId, rpcServer);
  }

  const proposals: Proposal[] = [];
  for (const id of proposalIds) {
    try {
      const detail = await getProposalDetail(id, contractId, rpcServer, overview);
      if (detail) {
        proposals.push(detail);
      }
    } catch {
      // Gracefully continue on individual failure
    }
  }

  return { overview, proposals };
}
