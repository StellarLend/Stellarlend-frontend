/**
 * lib/protocol-status.ts
 *
 * Reads on-chain protocol status from the StellarLend lending contract:
 *   - Pause flags (get_pause_state per PauseType)
 *   - Emergency state (DataKey::EmergencyState from instance storage)
 *
 * The allowedActions() pure function mirrors the contract's
 * check_pause_status / check_emergency_status gate exactly.
 */

import {
  Account,
  Address,
  Contract,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types — mirror the contract enums
// ---------------------------------------------------------------------------

/** PauseType variants (lib.rs L460-L470). */
export const PAUSE_TYPES = [
  "All",
  "Supply",
  "Borrow",
  "Withdraw",
  "Repay",
  "Liquidate",
] as const;
export type PauseType = (typeof PAUSE_TYPES)[number];
export type PauseFlags = Record<PauseType, boolean>;

/** EmergencyState variants (lib.rs L452-L458). */
export type EmergencyState = "Normal" | "Shutdown" | "Recovery";

export type ProtocolStatus =
  | { kind: "ok"; emergency: EmergencyState; paused: PauseFlags; ledger: number }
  | { kind: "unknown"; error: string };

/** Actions the UI presents to the user. */
export type ActionName = "supply" | "withdraw" | "borrow" | "repay" | "liquidate";

const ALL_ACTIONS: ActionName[] = [
  "supply",
  "withdraw",
  "borrow",
  "repay",
  "liquidate",
];

const ACTION_TO_PAUSE: Record<ActionName, Exclude<PauseType, "All">> = {
  supply: "Supply",
  borrow: "Borrow",
  withdraw: "Withdraw",
  repay: "Repay",
  liquidate: "Liquidate",
};

// ---------------------------------------------------------------------------
// allowedActions — pure function, no I/O
// ---------------------------------------------------------------------------

/**
 * Returns the set of actions the contract would accept given the current
 * protocol status. Mirrors check_pause_status → check_emergency_status order.
 *
 * - unknown (RPC failure): all actions are returned (spec: "does not disable actions")
 * - Shutdown: no actions
 * - All paused: no actions
 * - Recovery: only Withdraw, Repay, Liquidate (minus any individual pause)
 * - Normal: all actions minus individually paused ones
 */
export function allowedActions(status: ProtocolStatus): Set<ActionName> {
  if (status.kind === "unknown") return new Set(ALL_ACTIONS);

  // check_emergency_status: Shutdown blocks everything
  if (status.emergency === "Shutdown") return new Set();

  // check_pause_status: All pauses everything (evaluated before individual flags)
  if (status.paused.All) return new Set();

  const blocked = new Set<ActionName>();

  // check_emergency_status: Recovery blocks Supply and Borrow
  if (status.emergency === "Recovery") {
    blocked.add("supply");
    blocked.add("borrow");
  }

  // check_pause_status: individual flags
  for (const action of ALL_ACTIONS) {
    if (status.paused[ACTION_TO_PAUSE[action]]) {
      blocked.add(action);
    }
  }

  return new Set(ALL_ACTIONS.filter((a) => !blocked.has(a)));
}

// ---------------------------------------------------------------------------
// EmergencyState decoding — exported for unit tests
// ---------------------------------------------------------------------------

/**
 * Decodes EmergencyState from already-decoded (via scValToNative) storage
 * entries. The DataKey::EmergencyState key is encoded as
 * ScVal::Vec([Symbol("EmergencyState")]) → decoded as ["EmergencyState"].
 * The value is similarly ScVal::Vec([Symbol("Normal"|"Shutdown"|"Recovery")]).
 */
export function decodeEmergencyStateFromStorage(
  storage: Array<{ key: unknown; val: unknown }>
): EmergencyState {
  for (const entry of storage) {
    const k = entry.key;
    if (
      Array.isArray(k) &&
      k.length === 1 &&
      k[0] === "EmergencyState"
    ) {
      const v = entry.val;
      // Value is an enum variant: ["Shutdown"], ["Recovery"], or ["Normal"]
      const variant =
        Array.isArray(v) && v.length === 1 ? v[0] : v;
      if (variant === "Shutdown") return "Shutdown";
      if (variant === "Recovery") return "Recovery";
      return "Normal";
    }
  }
  // Absent key mirrors get_emergency_state default (lib.rs L3757-L3762)
  return "Normal";
}

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------

const SIMULATION_SOURCE =
  "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";

function makeServer(): rpc.Server {
  return new rpc.Server(config.rpc);
}

async function readPauseFlag(
  server: rpc.Server,
  passphrase: string,
  pauseType: PauseType
): Promise<boolean> {
  const tx = new TransactionBuilder(
    new Account(SIMULATION_SOURCE, "0"),
    { fee: "100", networkPassphrase: passphrase }
  )
    .addOperation(
      new Contract(config.lendingId).call(
        "get_pause_state",
        nativeToScVal([pauseType], { type: ["symbol"] })
      )
    )
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);

  // Treat simulation errors as "not paused" — expired or unknown pause types
  // return false which is the safe default (no false positives blocking users).
  if (rpc.Api.isSimulationError(result)) return false;
  if (!result.result) return false;
  const val = scValToNative(result.result.retval);
  return val === true;
}

async function readEmergencyStateFromRpc(
  server: rpc.Server
): Promise<EmergencyState> {
  const contractAddr = Address.fromString(config.lendingId).toScAddress();
  const ledgerKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contractAddr,
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    })
  );

  const response = await server.getLedgerEntries(ledgerKey);
  if (!response.entries || response.entries.length === 0) return "Normal";

  let rawStorage: Array<{ key: () => xdr.ScVal; val: () => xdr.ScVal }> | null = null;
  try {
    const entryData = response.entries[0].val as unknown as {
      contractData: () => {
        val: () => {
          instance: () => {
            storage: () => Array<{ key: () => xdr.ScVal; val: () => xdr.ScVal }> | null;
          };
        };
      };
    };
    rawStorage = entryData.contractData().val().instance().storage();
  } catch {
    // Archived or upgraded contract — treat as unknown, caller will handle
    throw new Error("Contract instance unavailable (archived or upgraded).");
  }
  if (!rawStorage) return "Normal";

  // Decode each entry key/value via scValToNative and delegate to pure decoder
  const storage = rawStorage.map((e) => {
    let key: unknown = null;
    let val: unknown = null;
    try { key = scValToNative(e.key()); } catch { /* skip */ }
    try { val = scValToNative(e.val()); } catch { /* skip */ }
    return { key, val };
  });

  return decodeEmergencyStateFromStorage(storage);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches the current protocol status. Batches all simulations concurrently.
 * Returns { kind: "unknown" } on any RPC or network failure — callers must
 * NOT disable actions in that case (prevents false positives during outages).
 */
export async function getProtocolStatus(): Promise<ProtocolStatus> {
  if (!config.lendingId) {
    // No contract configured (demo / not deployed) — report Normal, no pauses.
    return {
      kind: "ok",
      emergency: "Normal",
      paused: {
        All: false,
        Supply: false,
        Borrow: false,
        Withdraw: false,
        Repay: false,
        Liquidate: false,
      },
      ledger: 0,
    };
  }

  try {
    const server = makeServer();

    // Fetch network passphrase and latest ledger sequence first (needed for tx builder)
    const [{ passphrase }, { sequence: ledger }] = await Promise.all([
      server.getNetwork(),
      server.getLatestLedger(),
    ]);

    // Batch emergency state + all pause flags concurrently
    const [emergency, ...pauseResults] = await Promise.all([
      readEmergencyStateFromRpc(server),
      ...PAUSE_TYPES.map((pt) => readPauseFlag(server, passphrase, pt)),
    ]);

    const paused = Object.fromEntries(
      PAUSE_TYPES.map((pt, i) => [pt, pauseResults[i]])
    ) as PauseFlags;

    return { kind: "ok", emergency, paused, ledger };
  } catch (err) {
    return { kind: "unknown", error: String(err) };
  }
}
