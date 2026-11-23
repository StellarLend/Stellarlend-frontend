import { Networks, nativeToScVal, type xdr } from "@stellar/stellar-sdk";
import { config } from "@/lib/config";
import { simulateRead } from "@/lib/soroban-read";

/** Result of a single read: a value or an "unavailable" marker (failed getter). */
export type Field<T> = { ok: true; value: T } | { ok: false; error: string };

export type ParamDiff = {
  field: string;
  prev: bigint | null;
  next: bigint;
  prevFormatted: string;
  nextFormatted: string;
  direction: "increase" | "decrease" | "unknown";
};

export type AuditLogEntry = {
  sequence: bigint;
  action: string;
  actor: string;
  ledger: number;
  params?: Record<string, bigint | number>;
  diffs?: ParamDiff[];
};

export type GovernanceSnapshot = {
  admin: Field<string | null>;
  guardian: Field<string | null>;
  oracle: Field<string | null>;
  minBorrow: Field<bigint>;
  depositCap: Field<bigint>;
  borrowCap: Field<bigint>;
  closeFactorBps: Field<number>;
  liquidationThresholdBps: Field<number>;
  liquidationIncentiveBps: Field<number>;
  rateParams: Field<Record<string, bigint | number>>;
  maxFlashBps: Field<number>;
  audit: Field<AuditLogEntry[]>;
};

/** Generic read-only contract call: (method, args) -> decoded native value. */
export type ContractReader = (method: string, args?: xdr.ScVal[]) => Promise<unknown>;

export const AUDIT_PAGE_SIZE = 20;

/**
 * Builds a reader that simulates a contract call from a throwaway source
 * account. Nothing is signed or submitted, and no fees are paid.
 */
export function createContractReader(contractId: string, rpcUrl = config.rpc, passphrase = config.networkPassphrase || Networks.TESTNET): ContractReader {
  return async (method, args = []) => {
    const { native } = await simulateRead({
      contractId,
      method,
      args,
      rpcUrl,
      passphrase,
    });
    return native;
  };
}

const settle = async <T,>(promise: Promise<unknown>, map: (raw: unknown) => T): Promise<Field<T>> => {
  const [r] = await Promise.allSettled([promise.then(map)]);
  return r.status === "fulfilled" ? { ok: true, value: r.value } : { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
};

const toAddress = (raw: unknown): string | null => (raw === null || raw === undefined ? null : String(raw));
const toBig = (raw: unknown): bigint => BigInt(raw as bigint | number | string);
const toNum = (raw: unknown): number => Number(raw);

export function decodeRateParams(raw: unknown): Record<string, bigint | number> {
  if (!raw || typeof raw !== "object") throw new Error("Invalid RateParams");
  const out: Record<string, bigint | number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "bigint" || typeof value === "number") out[key] = value;
  }
  return out;
}

export function diffParams(
  prev: Record<string, bigint | number> | null | undefined,
  next: Record<string, bigint | number> | null | undefined,
  locale = "en"
): ParamDiff[] {
  if (!next) return [];
  const diffs: ParamDiff[] = [];
  for (const [key, nextValRaw] of Object.entries(next)) {
    const nextVal = typeof nextValRaw === "bigint" ? nextValRaw : BigInt(Math.round(Number(nextValRaw)));
    const isBps = key.endsWith("_bps");
    const nextFormatted = isBps
      ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(Number(nextVal) / 10_000)
      : nextVal.toString();

    if (!prev || !(key in prev) || prev[key] === null || prev[key] === undefined) {
      diffs.push({
        field: key,
        prev: null,
        next: nextVal,
        prevFormatted: "unknown",
        nextFormatted,
        direction: "unknown",
      });
      continue;
    }

    const prevValRaw = prev[key];
    const prevVal = typeof prevValRaw === "bigint" ? prevValRaw : BigInt(Math.round(Number(prevValRaw)));
    if (prevVal === nextVal) {
      continue;
    }

    const prevFormatted = isBps
      ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(Number(prevVal) / 10_000)
      : prevVal.toString();

    const direction = nextVal > prevVal ? "increase" : "decrease";
    diffs.push({
      field: key,
      prev: prevVal,
      next: nextVal,
      prevFormatted,
      nextFormatted,
      direction,
    });
  }
  return diffs;
}

export function attachAuditDiffs(entries: AuditLogEntry[], locale = "en"): AuditLogEntry[] {
  for (let i = 0; i < entries.length; i++) {
    const curr = entries[i];
    if (curr.diffs) continue;
    if (curr.params) {
      const prevEntry = entries.slice(i + 1).find((e) => e.params);
      curr.diffs = diffParams(prevEntry?.params ?? null, curr.params, locale);
    }
  }
  return entries;
}

export function decodeAuditEntries(raw: unknown): AuditLogEntry[] {
  if (!Array.isArray(raw)) throw new Error("Invalid audit log");
  const entries: AuditLogEntry[] = raw
    .map((e) => {
      const entry: AuditLogEntry = {
        sequence: toBig(e.sequence),
        action: String(e.action),
        actor: String(e.actor),
        ledger: toNum(e.ledger),
      };
      if (e.params && typeof e.params === "object") {
        entry.params = decodeRateParams(e.params);
      }
      if (Array.isArray(e.diffs)) {
        entry.diffs = e.diffs;
      }
      return entry;
    })
    .sort((a, b) => (a.sequence < b.sequence ? 1 : a.sequence > b.sequence ? -1 : 0));
  return attachAuditDiffs(entries);
}

/**
 * Reads every governance getter concurrently (fixed number of calls, audit
 * log fetched in a single call). One failing read only marks that field.
 */
export async function getGovernanceSnapshot(read: ContractReader, auditLimit = AUDIT_PAGE_SIZE): Promise<GovernanceSnapshot> {
  const [admin, guardian, oracle, minBorrow, depositCap, borrowCap, closeFactorBps, liquidationThresholdBps, liquidationIncentiveBps, rateParams, maxFlashBps, audit] =
    await Promise.all([
      settle(read("get_admin"), toAddress),
      settle(read("get_guardian"), toAddress),
      settle(read("get_oracle"), toAddress),
      settle(read("get_min_borrow"), toBig),
      settle(read("get_deposit_cap"), toBig),
      settle(read("get_borrow_cap"), toBig),
      settle(read("get_close_factor"), toNum),
      settle(read("get_liquidation_threshold"), toNum),
      settle(read("get_liquidation_incentive"), toNum),
      settle(read("get_rate_params"), decodeRateParams),
      settle(read("get_max_flash_bps"), toNum),
      settle(read("get_governance_audit_entries", [nativeToScVal(auditLimit, { type: "u32" })]), decodeAuditEntries),
    ]);
  return { admin, guardian, oracle, minBorrow, depositCap, borrowCap, closeFactorBps, liquidationThresholdBps, liquidationIncentiveBps, rateParams, maxFlashBps, audit };
}
