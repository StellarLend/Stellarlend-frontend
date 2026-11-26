import {
  Account,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
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
  if (custom) {
    return custom;
  }
  const resolvedRpcUrl = rpcUrl || getSorobanRpcUrl();
  return new rpc.Server(resolvedRpcUrl, {
    allowHttp: resolvedRpcUrl.startsWith("http://"),
  });
}

export function getSorobanRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
    config.rpc ||
    "https://soroban-testnet.stellar.org"
  );
}

export function getNetworkPassphrase(): string {
  const network =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK || config.network || "testnet";
  return network === "mainnet" || network === "public"
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

export interface ContractReadResult<T = unknown> {
  result: xdr.ScVal | null;
  native: T | null;
  raw: rpc.Api.SimulateTransactionResponse;
}

/**
 * Simulate a read-only contract call and return the raw ScVal, decoded native
 * value, and complete RPC response.
 */
export async function simulateContractRead<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<ContractReadResult<T>> {
  const rpcUrl = getSorobanRpcUrl();
  const passphrase = getNetworkPassphrase();
  const server = getRpcServer(undefined, rpcUrl);
  const source = new Account(SIMULATION_SOURCE_ACCOUNT, "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  let simulation: rpc.Api.SimulateTransactionResponse;
  try {
    simulation = await server.simulateTransaction(tx);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Simulation error for ${method}: ${message}`);
  }

  if (!rpc.Api.isSimulationSuccess(simulation)) {
    const errorMessage = rpc.Api.isSimulationError(simulation)
      ? simulation.error
      : "Simulation error";
    throw new Error(`Simulation error for ${method}: ${errorMessage}`);
  }

  const scVal = simulation.result?.retval ?? null;
  if (!scVal) {
    throw new Error(
      `Simulation error for ${method}: No return value for ${method}`,
    );
  }

  let native: T | null;
  try {
    native = scValToNative(scVal) as T;
  } catch {
    native = null;
  }

  return {
    result: scVal,
    native,
    raw: simulation,
  };
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
