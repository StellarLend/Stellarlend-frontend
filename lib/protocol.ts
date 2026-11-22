import {
  Account,
  Operation,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

export interface ProtocolMetrics {
  totalSupply: bigint;
  totalBorrow: bigint;
  utilizationBps: number;
  ledger: number;
}

export interface GetProtocolMetricsOptions {
  contractId?: string;
  rpcUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DUMMY_SOURCE_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

let lastLoggedError: string | null = null;

function logRpcErrorOnce(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message !== lastLoggedError) {
    lastLoggedError = message;
    console.error("[ProtocolMetrics] Failed to fetch protocol metrics from RPC:", message);
  }
}

/**
 * Fetch get_protocol_metrics from the deployed lending contract.
 * Uses a throwaway source account and simulateTransaction on Soroban RPC (read-only, no signing, no fees).
 * Returns null if contractId is unset or simulation fails/times out, logging the error once.
 */
export async function getProtocolMetrics(
  options?: GetProtocolMetricsOptions
): Promise<ProtocolMetrics | null> {
  const contractId = options?.contractId ?? config.lendingId;
  const rpcUrl = options?.rpcUrl ?? config.rpc;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!contractId || !rpcUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const tx = new TransactionBuilder(
      new Account(DUMMY_SOURCE_ACCOUNT, "0"),
      {
        fee: "100",
        networkPassphrase: config.networkPassphrase || "Test SDF Network ; September 2015",
      }
    )
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: "get_protocol_metrics",
          args: [],
        })
      )
      .setTimeout(30)
      .build();

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: [tx.toXDR()],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as {
      result?: {
        retval?: string;
        error?: string;
      };
      error?: {
        message?: string;
        code?: number;
      };
    };

    if (json.error) {
      throw new Error(json.error.message || `RPC error code ${json.error.code}`);
    }

    if (json.result?.error) {
      throw new Error(`Simulation error: ${json.result.error}`);
    }

    if (!json.result?.retval) {
      throw new Error("Simulation returned no retval");
    }

    const scVal = xdr.ScVal.fromXDR(json.result.retval, "base64");
    const native = scValToNative(scVal) as Record<string, unknown>;

    return decodeProtocolMetricsScVal(native);
  } catch (err: unknown) {
    logRpcErrorOnce(err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Decodes the native Map or object parsed from get_protocol_metrics ScVal.
 * Keeps totalSupply and totalBorrow as bigint (no Number() truncation).
 * Handles zero supply safely (utilization 0).
 */
export function decodeProtocolMetricsScVal(native: unknown): ProtocolMetrics {
  if (!native || typeof native !== "object") {
    throw new Error("Invalid metrics object received from ScVal");
  }

  const map = native as Record<string, unknown>;

  const rawSupply = map.total_supply ?? map.totalSupply ?? 0n;
  const rawBorrow = map.total_borrow ?? map.totalBorrow ?? 0n;
  const rawUtilizationBps = map.utilization_bps ?? map.utilizationBps ?? 0;
  const rawLedger = map.ledger ?? 0;

  const totalSupply = typeof rawSupply === "bigint" ? rawSupply : BigInt(String(rawSupply));
  const totalBorrow = typeof rawBorrow === "bigint" ? rawBorrow : BigInt(String(rawBorrow));

  let utilizationBps = Number(rawUtilizationBps);
  if (totalSupply === 0n) {
    utilizationBps = 0;
  }

  const ledger = Number(rawLedger);

  return {
    totalSupply,
    totalBorrow,
    utilizationBps,
    ledger,
  };
}
