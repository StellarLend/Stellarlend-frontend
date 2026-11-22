import { rpc, xdr } from "@stellar/stellar-sdk";
import { config } from "./config";
import {
  SIMULATION_SOURCE_ACCOUNT,
  SimulationError,
  simulateRead as simulateReadEntry,
  type SimulateReadOutput,
  type SimulateReadParams,
} from "./soroban-read";

export { SIMULATION_SOURCE_ACCOUNT, SimulationError };
export type { SimulateReadOutput, SimulateReadParams };

export interface SimulateReadOptions {
  rpcUrl?: string;
  customRpcServer?: rpc.Server;
  networkPassphrase?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface SimulateReadResult<T = unknown> {
  result: xdr.ScVal | null;
  scVal: xdr.ScVal | null;
  native: T | null;
  latestLedger: number;
}

export function getRpcServer(custom?: rpc.Server, rpcUrl?: string): rpc.Server {
  return custom || new rpc.Server(rpcUrl || config.rpc);
}

/**
 * Generic helper to simulate a read-only contract call on Soroban RPC (no signature, no fee).
 * Supports both `{ contractId, method, args, rpcUrl?, passphrase? }` and legacy positional arguments.
 */
export async function simulateRead<T = unknown>(
  params: SimulateReadParams,
): Promise<SimulateReadOutput<T>>;
export async function simulateRead<T = unknown>(
  contractId: string,
  method: string,
  args?: xdr.ScVal[],
  options?: SimulateReadOptions,
): Promise<SimulateReadResult<T>>;
export async function simulateRead<T = unknown>(
  contractIdOrParams: string | SimulateReadParams,
  method?: string,
  args: xdr.ScVal[] = [],
  options: SimulateReadOptions = {},
): Promise<SimulateReadOutput<T> | SimulateReadResult<T>> {
  if (typeof contractIdOrParams === "object" && contractIdOrParams !== null) {
    return simulateReadEntry<T>(contractIdOrParams);
  }

  const contractId = contractIdOrParams;
  const fnName = method ?? "";
  if (!contractId) {
    throw new SimulationError("", fnName, "Contract ID is required for simulateRead");
  }

  const out = await simulateReadEntry<T>({
    contractId,
    method: fnName,
    args,
    rpcUrl: options.rpcUrl,
    passphrase: options.networkPassphrase,
    rpcServer: options.customRpcServer,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
  });

  return {
    result: out.scVal,
    scVal: out.scVal,
    native: out.native,
    latestLedger: out.latestLedger,
  };
}
