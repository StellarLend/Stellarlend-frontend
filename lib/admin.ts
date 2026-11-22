import {
  rpc,
  TransactionBuilder,
  Account,
  Operation,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { executeContractCall, type TxSubmitOptions } from "./tx";

export type AdminRole = "admin" | "guardian" | "none";

export const PAUSE_TYPES = [
  "All",
  "Deposit",
  "Withdraw",
  "Borrow",
  "Repay",
  "Liquidation",
  "FlashLoan",
] as const;

export type PauseType = (typeof PAUSE_TYPES)[number];

export const EMERGENCY_STATES = ["Normal", "Shutdown", "Recovery"] as const;

export type EmergencyState = (typeof EMERGENCY_STATES)[number];

export const SECONDS_PER_LEDGER = 5;
export const MAX_U32 = 4294967295;

/**
 * Computes the role of a given address based on on-chain admin and guardian addresses.
 */
export function computeRole(
  connectedAddress: string | null | undefined,
  adminAddress: string | null | undefined,
  guardianAddress: string | null | undefined
): AdminRole {
  if (!connectedAddress) return "none";
  if (adminAddress && connectedAddress === adminAddress) {
    return "admin";
  }
  if (guardianAddress && connectedAddress === guardianAddress) {
    return "guardian";
  }
  return "none";
}

/**
 * Returns the list of emergency states allowed for a given role.
 * - Admin: Normal, Shutdown, Recovery
 * - Guardian: Shutdown only
 * - None: empty
 */
export function getAllowedTransitions(role: AdminRole): EmergencyState[] {
  if (role === "admin") {
    return ["Normal", "Shutdown", "Recovery"];
  }
  if (role === "guardian") {
    return ["Shutdown"];
  }
  return [];
}

/**
 * Checks whether a specific emergency state transition is allowed for a given role.
 */
export function isTransitionAllowed(role: AdminRole, targetState: EmergencyState): boolean {
  return getAllowedTransitions(role).includes(targetState);
}

/**
 * Converts hours to ledger count based on ~5s per ledger, clamping to u32 max.
 */
export function hoursToLedgers(hours: number): number {
  if (isNaN(hours) || hours <= 0) return 0;
  const totalSeconds = hours * 3600;
  const ledgers = Math.round(totalSeconds / SECONDS_PER_LEDGER);
  return Math.min(Math.max(0, ledgers), MAX_U32);
}

/**
 * Computes expires_at_ledger from current ledger and ttl_ledgers, clamping to u32 max.
 */
export function computeExpiresAtLedger(
  currentLedger: number,
  ttlLedgers: number
): number {
  const safeCurrent = Math.min(Math.max(0, Math.floor(currentLedger)), MAX_U32);
  const safeTtl = Math.min(Math.max(0, Math.floor(ttlLedgers)), MAX_U32);
  const sum = safeCurrent + safeTtl;
  return Math.min(sum, MAX_U32);
}

/**
 * Encodes a PauseType enum as an ScVal vec containing a symbol ScVal.
 */
export function encodePauseTypeScVal(pauseType: PauseType): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(pauseType)]);
}

/**
 * Encodes an EmergencyState enum as an ScVal vec containing a symbol ScVal.
 */
export function encodeEmergencyStateScVal(state: EmergencyState): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(state)]);
}

/**
 * Reads get_admin from the on-chain contract via transaction simulation.
 */
export async function getAdmin(
  contractId: string = config.lendingId,
  rpcServer: rpc.Server = new rpc.Server(config.rpc)
): Promise<string | null> {
  if (!contractId) return null;
  try {
    const tx = new TransactionBuilder(
      new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"),
      {
        fee: "100",
        networkPassphrase: config.networkPassphrase,
      }
    )
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: "get_admin",
          args: [],
        })
      )
      .setTimeout(30)
      .build();

    const res = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(res) && res.result?.retval) {
      const native = scValToNative(res.result.retval);
      if (typeof native === "string") return native;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads get_guardian from the on-chain contract via transaction simulation.
 */
export async function getGuardian(
  contractId: string = config.lendingId,
  rpcServer: rpc.Server = new rpc.Server(config.rpc)
): Promise<string | null> {
  if (!contractId) return null;
  try {
    const tx = new TransactionBuilder(
      new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"),
      {
        fee: "100",
        networkPassphrase: config.networkPassphrase,
      }
    )
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: "get_guardian",
          args: [],
        })
      )
      .setTimeout(30)
      .build();

    const res = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(res) && res.result?.retval) {
      const native = scValToNative(res.result.retval);
      if (typeof native === "string") return native;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads get_pause_state(pause_type) from the on-chain contract.
 */
export async function getPauseState(
  pauseType: PauseType,
  contractId: string = config.lendingId,
  rpcServer: rpc.Server = new rpc.Server(config.rpc)
): Promise<boolean> {
  if (!contractId) return false;
  try {
    const pauseArg = encodePauseTypeScVal(pauseType);
    const tx = new TransactionBuilder(
      new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"),
      {
        fee: "100",
        networkPassphrase: config.networkPassphrase,
      }
    )
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: "get_pause_state",
          args: [pauseArg],
        })
      )
      .setTimeout(30)
      .build();

    const res = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(res) && res.result?.retval) {
      return Boolean(scValToNative(res.result.retval));
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Reads instance storage to retrieve emergency state and pause states.
 */
export async function getContractEmergencyData(
  contractId: string = config.lendingId,
  rpcServer: rpc.Server = new rpc.Server(config.rpc)
): Promise<{
  emergencyState: EmergencyState;
  pauseStates: Record<PauseType, { paused: boolean; expiresAtLedger?: number }>;
}> {
  const defaultPauseStates: Record<
    PauseType,
    { paused: boolean; expiresAtLedger?: number }
  > = {
    All: { paused: false },
    Deposit: { paused: false },
    Withdraw: { paused: false },
    Borrow: { paused: false },
    Repay: { paused: false },
    Liquidation: { paused: false },
    FlashLoan: { paused: false },
  };

  let emergencyState: EmergencyState = "Normal";

  if (!contractId) {
    return { emergencyState, pauseStates: defaultPauseStates };
  }

  try {
    const contractAddr = new (await import("@stellar/stellar-sdk")).Address(
      contractId
    );
    const key = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: contractAddr.toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent,
      })
    );

    const res = await rpcServer.getLedgerEntries(key);
    if (res.entries && res.entries.length > 0) {
      const entry = res.entries[0] as any;
      const cd = entry.val?.contractData || entry.val;
      const instance = cd?.val?.instance || cd?.val;
      const storage = instance?.storage;

      if (Array.isArray(storage)) {
        for (const item of storage) {
          try {
            const nativeKey = scValToNative(item.key);
            const nativeVal = scValToNative(item.val);

            // Handle [ 'EmergencyState' ]
            if (
              Array.isArray(nativeKey) &&
              nativeKey[0] === "EmergencyState" &&
              Array.isArray(nativeVal) &&
              typeof nativeVal[0] === "string"
            ) {
              const stateStr = nativeVal[0];
              if (EMERGENCY_STATES.includes(stateStr as EmergencyState)) {
                emergencyState = stateStr as EmergencyState;
              }
            }

            // Handle [ 'PauseState', [ 'All' ] ]
            if (
              Array.isArray(nativeKey) &&
              nativeKey[0] === "PauseState" &&
              Array.isArray(nativeKey[1])
            ) {
              const op = nativeKey[1][0] as PauseType;
              if (PAUSE_TYPES.includes(op) && nativeVal && typeof nativeVal === "object") {
                defaultPauseStates[op] = {
                  paused: Boolean(nativeVal.paused),
                  expiresAtLedger:
                    typeof nativeVal.expires_at_ledger === "number"
                      ? nativeVal.expires_at_ledger
                      : Number(nativeVal.expires_at_ledger || 0),
                };
              }
            }
          } catch {}
        }
      }
    }
  } catch {}

  return { emergencyState, pauseStates: defaultPauseStates };
}

/**
 * Invokes set_pause(pause_type, paused, ttl_ledgers) with Freighter.
 */
export async function setPause(
  pauseType: PauseType,
  paused: boolean,
  ttlLedgers: number,
  options: TxSubmitOptions
): Promise<{ txHash: string; status: "confirmed" }> {
  const safeTtl = Math.min(Math.max(0, Math.floor(ttlLedgers)), MAX_U32);
  const args: xdr.ScVal[] = [
    encodePauseTypeScVal(pauseType),
    xdr.ScVal.scvBool(paused),
    xdr.ScVal.scvU32(safeTtl),
  ];

  return executeContractCall("set_pause", args, options);
}

/**
 * Invokes set_emergency_state(state) with Freighter.
 */
export async function setEmergencyState(
  state: EmergencyState,
  options: TxSubmitOptions
): Promise<{ txHash: string; status: "confirmed" }> {
  const args: xdr.ScVal[] = [encodeEmergencyStateScVal(state)];

  return executeContractCall("set_emergency_state", args, options);
}
