import { Account, BASE_FEE, Contract, Keypair, Networks, rpc, scValToNative, nativeToScVal, TransactionBuilder, type xdr } from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

/** Result of a single read: a value or an "unavailable" marker (failed getter). */
export type Field<T> = { ok: true; value: T } | { ok: false; error: string };

export type AuditLogEntry = { sequence: bigint; action: string; actor: string; ledger: number };

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
  const server = new rpc.Server(rpcUrl);
  return async (method, args = []) => {
    const source = new Account(Keypair.random().publicKey(), "0");
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
    if (!sim.result) throw new Error(`No value returned for ${method}`);
    return scValToNative(sim.result.retval);
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

export function decodeAuditEntries(raw: unknown): AuditLogEntry[] {
  if (!Array.isArray(raw)) throw new Error("Invalid audit log");
  return raw
    .map((e) => ({ sequence: toBig(e.sequence), action: String(e.action), actor: String(e.actor), ledger: toNum(e.ledger) }))
    .sort((a, b) => (a.sequence < b.sequence ? 1 : a.sequence > b.sequence ? -1 : 0));
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
