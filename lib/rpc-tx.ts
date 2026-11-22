import { rpc } from "@stellar/stellar-sdk";
import { config } from "./config";

export interface PollTransactionStatusOptions {
  server: rpc.Server;
  timeoutMs?: number;
  intervalMs?: number;
  parseError?: (error: string) => string;
  signal?: AbortSignal;
}

export function getRpcServer(custom?: rpc.Server, rpcUrl?: string): rpc.Server {
  return custom || new rpc.Server(rpcUrl || config.rpc);
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }
  const error = new Error(
    signal.reason === undefined
      ? "The operation was aborted"
      : String(signal.reason),
  );
  error.name = "AbortError";
  return error;
}

function requestWithSignal<T>(
  request: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) {
    return request();
  }
  if (signal.aborted) {
    return Promise.reject(abortError(signal));
  }

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortError(signal));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve()
      .then(request)
      .then(
        (value) => {
          cleanup();
          resolve(value);
        },
        (error: unknown) => {
          cleanup();
          reject(error);
        },
      );
  });
}

function waitForInterval(intervalMs: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (signal.aborted) {
    return Promise.reject(abortError(signal));
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, intervalMs);
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(abortError(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function pollTransactionStatus(
  txHash: string,
  {
    server,
    timeoutMs = 60_000,
    intervalMs = 1_500,
    parseError,
    signal,
  }: PollTransactionStatusOptions,
): Promise<rpc.Api.GetTransactionResponse> {
  const start = Date.now();
  if (signal?.aborted) {
    throw abortError(signal);
  }

  while (Date.now() - start < timeoutMs) {
    if (signal?.aborted) {
      throw abortError(signal);
    }

    const tx = await requestWithSignal(
      () => server.getTransaction(txHash),
      signal,
    );
    if (signal?.aborted) {
      throw abortError(signal);
    }

    if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return tx;
    }
    if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
      const errorDetail = tx.resultXdr?.toXDR("base64");
      const message = parseError
        ? parseError(errorDetail || "Unknown execution failure")
        : errorDetail || "Transaction execution failed";
      throw new Error(`Transaction failed on-chain: ${message}`);
    }

    await waitForInterval(intervalMs, signal);
  }

  throw new Error(`Transaction timed out while waiting for confirmation: ${txHash}`);
}
