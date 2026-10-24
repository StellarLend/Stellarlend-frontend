/**
 * On-chain client for the StellarLend lending contract on Stellar testnet.
 *
 * The contract's single-asset entrypoints are:
 *   deposit(user, amount) -> Result<i128, LendingError>
 *   withdraw(user, amount) -> Result<i128, LendingError>
 *   borrow(user, amount) -> Result<i128, LendingError>
 *   repay(user, amount) -> Result<i128, LendingError>
 *   get_position(user) -> PositionSummary { collateral, debt, health_factor }
 *
 * Amounts are raw `i128` base units (1 XLM = 10,000,000). The wallet must be on
 * the configured Stellar network before any signature is requested. Secret keys
 * are never requested, stored, or logged.
 */

import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  scValToNative,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";
import { decodeContractError, type DecodedContractError } from "@/lib/errors/decode";

export const HEALTH_FACTOR_SCALE = 10_000n;
export const HEALTH_FACTOR_NO_DEBT = 100_000_000n;

const POLL_INTERVAL_MS = 2_000;
const TX_TIMEOUT_MS = 120_000;

export type LendingAction = "deposit" | "withdraw" | "borrow" | "repay";
export type LendingTxStatus = "pending" | "confirmed" | "failed" | "cancelled" | "timeout";

export type LendingTx = {
  status: LendingTxStatus;
  hash: string | null;
  error: DecodedContractError | null;
};

export type LendingPosition = {
  collateral: bigint;
  debt: bigint;
  healthFactor: bigint;
};

export const NETWORK_PASSPHRASE =
  config.networkPassphrase ?? (config.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET);

/** A Stellar contract ID is a 56-character strkey starting with `C`. */
export function isValidContractId(id: string | undefined | null): id is string {
  return typeof id === "string" && /^C[A-Z2-7]{55}$/.test(id);
}

/** On-chain mode is available only with a contract ID and an RPC endpoint. */
export function isOnChainConfigured(): boolean {
  return isValidContractId(config.lendingId) && Boolean(config.rpc);
}

export function server(): rpc.Server {
  return new rpc.Server(config.rpc);
}

async function simulateRead<T>(
  rpcServer: rpc.Server,
  sourceAddress: string,
  method: string,
  args: ReturnType<typeof nativeToScVal>[] = [],
): Promise<T> {
  const account = await rpcServer.getAccount(sourceAddress);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(config.lendingId).call(method, ...args))
    .setTimeout(30)
    .build();
  const simulation = await rpcServer.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }
  if (!simulation.result) throw new Error(`Soroban RPC returned no value for ${method}.`);
  return scValToNative(simulation.result.retval) as T;
}

export function decodePositionSummary(native: unknown): LendingPosition {
  if (typeof native !== "object" || native === null) {
    throw new Error("The contract returned an invalid position.");
  }
  const summary = native as Record<string, unknown>;
  return {
    collateral: BigInt(summary.collateral as bigint),
    debt: BigInt(summary.debt as bigint),
    healthFactor: BigInt(summary.health_factor as bigint),
  };
}

/** Read a user's position (collateral, debt and raw health factor). */
export async function readPosition(address: string): Promise<LendingPosition> {
  if (!isOnChainConfigured()) throw new Error("The lending contract is not configured.");
  const result = await simulateRead<unknown>(server(), address, "get_position", [
    new Address(address).toScVal(),
  ]);
  return decodePositionSummary(result);
}

/** Read the protocol minimum borrow amount (raw base units). */
export async function readMinBorrow(sourceAddress: string): Promise<bigint> {
  if (!isOnChainConfigured()) throw new Error("The lending contract is not configured.");
  const result = await simulateRead<bigint>(server(), sourceAddress, "get_min_borrow");
  return BigInt(result);
}

/**
 * Normalise a raw contract health factor to a ratio where 1.0 is the
 * liquidation threshold. Returns `null` for the debt-free sentinel.
 */
export function normaliseHealthFactor(healthFactor: bigint): number | null {
  if (healthFactor === HEALTH_FACTOR_NO_DEBT) return null;
  return Number(healthFactor) / Number(HEALTH_FACTOR_SCALE);
}

function decoded(status: LendingTxStatus, error: unknown, hash: string | null = null): LendingTx {
  return { status, hash, error: decodeContractError(error) };
}

function failed(error: unknown, hash: string | null = null): LendingTx {
  const decodedError = decodeContractError(error);
  if (decodedError.name === "UserRejected") return { status: "cancelled", hash, error: decodedError };
  return { status: "failed", hash, error: decodedError };
}

/**
 * Submit a lending action: validate, simulate and prepare, request a Freighter
 * signature after verifying the network, submit, then poll for a terminal
 * result. Never retries an uncertain submission.
 *
 * The returned value always represents the real outcome; `onUpdate` receives
 * intermediate pending states so the UI can disable duplicate submissions.
 */
export async function submitLendingAction(
  address: string,
  action: LendingAction,
  amount: bigint,
  onUpdate?: (tx: LendingTx) => void,
): Promise<LendingTx> {
  const notify = (tx: LendingTx) => {
    onUpdate?.(tx);
    return tx;
  };

  if (!isOnChainConfigured()) {
    return notify(decoded("failed", "The lending contract is not configured."));
  }
  if (amount <= 0n) {
    return notify(failed("Error(Contract, #1001)"));
  }

  try {
    const freighter = await import("@stellar/freighter-api");
    const network = await freighter.getNetwork();
    if (network.error) return notify(decoded("failed", network.error.message));
    if (network.networkPassphrase !== NETWORK_PASSPHRASE) {
      return notify(
        decoded(
          "failed",
          `Freighter is on ${network.network ?? "an unknown network"}. Switch to Stellar testnet before signing.`,
        ),
      );
    }

    const rpcServer = server();
    const account = await rpcServer.getAccount(address);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        new Contract(config.lendingId).call(
          action,
          new Address(address).toScVal(),
          nativeToScVal(amount, { type: "i128" }),
        ),
      )
      .setTimeout(30)
      .build();

    const simulation = await rpcServer.simulateTransaction(transaction);
    if (rpc.Api.isSimulationError(simulation)) {
      return notify(failed(simulation.error));
    }
    const prepared = await rpcServer.prepareTransaction(transaction);
    notify({ status: "pending", hash: null, error: null });
    const signed = await freighter.signTransaction(prepared.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    if (signed.error) return notify(failed(signed.error.message));
    if (!signed.signedTxXdr) return notify(decoded("failed", "Freighter did not return a signed transaction."));

    const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
    const submitted = await rpcServer.sendTransaction(signedTx);
    if (submitted.status === "ERROR") {
      return notify(failed(submitted.errorResult?.toXDR("base64") ?? "Soroban RPC rejected the transaction."));
    }

    const hash = submitted.hash;
    notify({ status: "pending", hash, error: null });

    const startedAt = Date.now();
    while (Date.now() - startedAt < TX_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const status = await rpcServer.getTransaction(hash);
      if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return notify({ status: "confirmed", hash, error: null });
      }
      if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
        return notify(failed(status.resultXdr?.toXDR("base64") ?? "The Soroban transaction failed.", hash));
      }
    }
    return notify({ status: "timeout", hash, error: null });
  } catch (error) {
    return notify(failed(error));
  }
}
