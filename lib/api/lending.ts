import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
  type xdr,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";
import { ContractNotConfiguredError, UpstreamRpcError } from "./errors";

/**
 * Public, read-only source account used to build Soroban simulations.
 *
 * This is intentionally a constant rather than a request parameter: accepting
 * a caller-supplied source or RPC URL would create an SSRF surface.
 */
const SIMULATION_SOURCE =
  "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";

const SIMULATION_TIMEOUT_SECONDS = 30;

export interface ProtocolMetrics {
  totalSupply: bigint;
  totalBorrow: bigint;
  utilizationBps: bigint;
  ledger: number;
  /** Populated when the value is read from the contract, not when served from cache. */
  fetchedAt: string;
}

export interface PositionSummary {
  collateral: bigint;
  debt: bigint;
  healthFactor: bigint;
  /** Populated when the value is read from the contract, not when served from cache. */
  fetchedAt: string;
}

type RawProtocolMetrics = {
  total_borrow?: unknown;
  total_supply?: unknown;
  utilization_bps?: unknown;
  ledger?: unknown;
};

type RawPositionSummary = {
  collateral?: unknown;
  debt?: unknown;
  health_factor?: unknown;
};

function requireLendingContract(): string {
  if (!config.lendingId) {
    throw new ContractNotConfiguredError();
  }
  return config.lendingId;
}

function rpcServer(): rpc.Server {
  return new rpc.Server(config.rpc);
}

async function simulate(
  server: rpc.Server,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<unknown> {
  const transaction = new TransactionBuilder(
    new Account(SIMULATION_SOURCE, "0"),
    {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    },
  )
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(SIMULATION_TIMEOUT_SECONDS)
    .build();

  let result: Awaited<ReturnType<rpc.Server["simulateTransaction"]>>;
  try {
    result = await server.simulateTransaction(transaction);
  } catch {
    throw new UpstreamRpcError("Soroban RPC request failed");
  }

  if (rpc.Api.isSimulationError(result)) {
    throw new UpstreamRpcError("Soroban RPC returned a simulation error");
  }
  if (!result.result) {
    throw new UpstreamRpcError("Soroban RPC returned no result");
  }

  return scValToNative(result.result.retval);
}

function toBigInt(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new UpstreamRpcError(`Contract returned an invalid ${field}`);
}

function toLedger(value: unknown): number {
  const ledger =
    typeof value === "bigint" ? Number(value) : (value as unknown);
  if (
    typeof ledger !== "number" ||
    !Number.isSafeInteger(ledger) ||
    ledger < 0
  ) {
    throw new UpstreamRpcError("Contract returned an invalid ledger");
  }
  return ledger;
}

/** Reads `get_protocol_metrics` from the configured lending contract. */
export async function fetchProtocolMetrics(): Promise<ProtocolMetrics> {
  const contractId = requireLendingContract();
  const raw = (await simulate(
    rpcServer(),
    contractId,
    "get_protocol_metrics",
  )) as RawProtocolMetrics;

  return {
    totalSupply: toBigInt(raw.total_supply, "total_supply"),
    totalBorrow: toBigInt(raw.total_borrow, "total_borrow"),
    utilizationBps: toBigInt(raw.utilization_bps, "utilization_bps"),
    ledger: toLedger(raw.ledger),
    fetchedAt: new Date().toISOString(),
  };
}

/** Reads `get_position` from the configured lending contract for a G-address. */
export async function fetchPosition(address: string): Promise<PositionSummary> {
  const contractId = requireLendingContract();
  const raw = (await simulate(
    rpcServer(),
    contractId,
    "get_position",
    [new Address(address).toScVal()],
  )) as RawPositionSummary;

  return {
    collateral: toBigInt(raw.collateral, "collateral"),
    debt: toBigInt(raw.debt, "debt"),
    healthFactor: toBigInt(raw.health_factor, "health_factor"),
    fetchedAt: new Date().toISOString(),
  };
}
