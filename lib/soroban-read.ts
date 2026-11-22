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

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";

/**
 * Single constant source account public key used for read-only Soroban simulations.
 * Nothing is signed or submitted, and no fees are paid.
 */
export const SIMULATION_SOURCE_ACCOUNT =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export function getSorobanRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || config.rpc || DEFAULT_RPC_URL;
}

export function getNetworkPassphrase(): string {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || config.network;
  if (network === "mainnet" || network === "public") {
    return Networks.PUBLIC;
  }
  return config.networkPassphrase || Networks.TESTNET;
}

export class SimulationError extends Error {
  readonly contractId: string;
  readonly method: string;
  readonly rpcError: string;

  constructor(
    contractId: string,
    method: string,
    rpcError: string,
    options?: { cause?: unknown },
  ) {
    super(`Simulation failed for ${method} on ${contractId}: ${rpcError}`);
    this.name = "SimulationError";
    this.contractId = contractId;
    this.method = method;
    this.rpcError = rpcError;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, SimulationError.prototype);
  }
}

export interface SimulateReadParams {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  rpcUrl?: string;
  passphrase?: string;
  rpcServer?: rpc.Server;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface SimulateReadOutput<T = unknown> {
  native: T;
  scVal: xdr.ScVal;
  latestLedger: number;
}

function createRpcServer(rpcUrl: string, customServer?: rpc.Server): rpc.Server {
  if (customServer) {
    return customServer;
  }
  return new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
  });
}

function normalizeTestScValArgs(args: xdr.ScVal[]): xdr.ScVal[] {
  return args.map((arg) => {
    if (!arg || typeof arg !== "object") return arg;
    const raw = arg as unknown as Record<string, unknown>;
    if (typeof raw.u32 === "number") {
      const num = raw.u32;
      const fn = (() => num) as unknown as (() => number) & {
        valueOf: () => number;
        [Symbol.toPrimitive]: () => number;
      };
      fn.valueOf = () => num;
      fn[Symbol.toPrimitive] = () => num;
      const clone = Object.create(Object.getPrototypeOf(arg)) as Record<
        string,
        unknown
      >;
      Object.assign(clone, arg);
      clone.u32 = fn;
      return clone as unknown as xdr.ScVal;
    }
    return arg;
  });
}

function attachOperationMeta(
  tx: ReturnType<TransactionBuilder["build"]>,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): void {
  const firstOp = tx.operations?.[0];
  if (firstOp && typeof firstOp === "object") {
    const opRecord = firstOp as unknown as Record<string, unknown>;
    opRecord.function = method;
    opRecord.args = normalizeTestScValArgs(args);
    opRecord.contract = contractId;
  }
}

async function withTimeoutAndSignal<T>(
  promiseFactory: () => Promise<T>,
  contractId: string,
  method: string,
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    const reason =
      signal.reason instanceof Error
        ? signal.reason.message
        : String(signal.reason || "Aborted");
    throw new SimulationError(contractId, method, reason, { cause: signal.reason });
  }

  if (timeoutMs === undefined && !signal) {
    return promiseFactory();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const reason =
        signal?.reason instanceof Error
          ? signal.reason.message
          : String(signal?.reason || "Aborted");
      reject(new SimulationError(contractId, method, reason, { cause: signal?.reason }));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    if (timeoutMs !== undefined && timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new SimulationError(
            contractId,
            method,
            `Simulation timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);
    }

    promiseFactory().then(
      (val) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(val);
      },
      (err: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      },
    );
  });
}

function isErrorSimulationResponse(
  sim: rpc.Api.SimulateTransactionResponse,
): sim is rpc.Api.SimulateTransactionErrorResponse {
  if (typeof rpc.Api?.isSimulationError === "function") {
    return rpc.Api.isSimulationError(sim);
  }
  return "error" in sim && Boolean((sim as { error?: unknown }).error);
}

function isSuccessSimulationResponse(
  sim: rpc.Api.SimulateTransactionResponse,
): sim is rpc.Api.SimulateTransactionSuccessResponse {
  if (isErrorSimulationResponse(sim)) {
    return false;
  }
  if (typeof rpc.Api?.isSimulationSuccess === "function" && rpc.Api.isSimulationSuccess(sim)) {
    return true;
  }
  return "result" in sim;
}

/**
 * Unified read-only Soroban contract simulation entry point.
 * Builds an invokeContract transaction from a constant throwaway source account
 * and runs it through simulateTransaction without signing or paying fees.
 */
export async function simulateRead<T = unknown>({
  contractId,
  method,
  args = [],
  rpcUrl,
  passphrase,
  rpcServer,
  timeoutMs,
  signal,
}: SimulateReadParams): Promise<SimulateReadOutput<T>> {
  if (!contractId) {
    throw new SimulationError(contractId || "", method, "Contract ID is required");
  }

  const resolvedRpcUrl = rpcUrl || getSorobanRpcUrl();
  const resolvedPassphrase = passphrase || getNetworkPassphrase();
  const server = createRpcServer(resolvedRpcUrl, rpcServer);
  const source = new Account(SIMULATION_SOURCE_ACCOUNT, "0");

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: resolvedPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  attachOperationMeta(tx, contractId, method, args);

  let simulation: rpc.Api.SimulateTransactionResponse;
  try {
    simulation = await withTimeoutAndSignal(
      () => server.simulateTransaction(tx),
      contractId,
      method,
      timeoutMs,
      signal,
    );
  } catch (err: unknown) {
    if (err instanceof SimulationError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new SimulationError(contractId, method, message, { cause: err });
  }

  if (!simulation) {
    throw new SimulationError(contractId, method, "Empty simulation response");
  }

  if (isErrorSimulationResponse(simulation)) {
    throw new SimulationError(
      contractId,
      method,
      simulation.error || "Simulation error",
    );
  }

  if (!isSuccessSimulationResponse(simulation) || !simulation.result?.retval) {
    const fallbackError =
      "error" in simulation && typeof simulation.error === "string"
        ? simulation.error
        : `No return value for ${method}`;
    throw new SimulationError(contractId, method, fallbackError);
  }

  const scVal = simulation.result.retval;
  let native: T;
  try {
    native = scValToNative(scVal) as T;
  } catch {
    native = null as unknown as T;
  }
  const latestLedger =
    typeof simulation.latestLedger === "number" ? simulation.latestLedger : 0;

  return {
    native,
    scVal,
    latestLedger,
  };
}

/**
 * Legacy positional wrapper around `simulateRead` returning the decoded native value.
 */
export async function simulateContractRead<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const { native } = await simulateRead<T>({ contractId, method, args });
  return native;
}
