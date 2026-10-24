import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import type { xdr } from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

/**
 * Scale factor for on-chain oracle prices.
 *
 * In StellarLend (and standard Soroban token decimal conventions), oracle prices
 * are stored with 7 decimal places (10^7, matching PRICE_DIVISOR = 10_000_000).
 * e.g., $0.12 is represented as 1_200_000 i128, and $1.00 is represented as 10_000_000 i128.
 */
export const ORACLE_PRICE_SCALE = BigInt(10_000_000);
export const ORACLE_PRICE_DECIMALS = 7;

/**
 * Maximum acceptable age of an oracle price in seconds before it is rejected
 * by contract borrowing and liquidation functions (DEFAULT_ORACLE_MAX_AGE_SECS).
 */
export const MAX_ORACLE_AGE_SECONDS = 3600;

export type PriceRecord = {
  price: bigint;
  timestamp: bigint;
};

export type PriceBounds = {
  min: bigint | null;
  max: bigint | null;
};

export type StalenessStatus = "fresh" | "stale" | "future" | "missing";

export type OracleAssetPrice = {
  assetId: string;
  symbol: string;
  price: bigint | null;
  priceNumber: number | null;
  timestamp: bigint | null;
  ageSeconds: number | null;
  status: StalenessStatus;
  bounds: PriceBounds;
  source: "oracle" | "demo";
};

const SIMULATION_SOURCE = "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";

let cachedServer: rpc.Server | null = null;
let cachedRpcUrl: string | null = null;

function getServer(rpcUrl = config.rpc): rpc.Server {
  if (!cachedServer || cachedRpcUrl !== rpcUrl) {
    cachedServer = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith("http://"),
    });
    cachedRpcUrl = rpcUrl;
  }
  return cachedServer;
}

/**
 * Decode an i128 / bigint value from unknown Soroban native representation.
 */
export function decodeI128(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Decode a u64 / bigint timestamp value from unknown Soroban native representation.
 */
export function decodeU64(value: unknown): bigint | null {
  const val = decodeI128(value);
  if (val === null || val < BigInt(0)) return null;
  return val;
}

/**
 * Decode PriceRecord { price: i128, timestamp: u64 } from ScVal or native Soroban object.
 * Supports None / null as well as Record structs or maps.
 */
export function decodePriceRecord(value: unknown): PriceRecord | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const rawPrice = record.price ?? record.Price;
  const rawTimestamp = record.timestamp ?? record.Timestamp;

  const price = decodeI128(rawPrice);
  const timestamp = decodeU64(rawTimestamp);

  if (price === null || timestamp === null) {
    return null;
  }

  return { price, timestamp };
}

/**
 * Decode PriceBounds (Option<i128>, Option<i128>) or struct { min, max }.
 */
export function decodePriceBounds(value: unknown): PriceBounds {
  if (!value) {
    return { min: null, max: null };
  }

  // Tuple representation [min, max]
  if (Array.isArray(value)) {
    const min = decodeI128(value[0]);
    const max = decodeI128(value[1]);
    return {
      min: min !== null && min > BigInt(0) ? min : null,
      max: max !== null && max > BigInt(0) ? max : null,
    };
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const min = decodeI128(obj.min ?? obj.min_price);
    const max = decodeI128(obj.max ?? obj.max_price);
    return {
      min: min !== null && min > BigInt(0) ? min : null,
      max: max !== null && max > BigInt(0) ? max : null,
    };
  }

  return { min: null, max: null };
}

/**
 * Converts a raw scaled i128 price to a JavaScript float.
 */
export function priceToFloat(price: bigint, scale = ORACLE_PRICE_SCALE): number {
  return Number(price) / Number(scale);
}

/**
 * Formats a scaled bigint price into a readable decimal string.
 */
export function formatOraclePrice(
  price: bigint,
  options?: { minDecimals?: number; maxDecimals?: number }
): string {
  const minDecimals = options?.minDecimals ?? 2;
  const maxDecimals = options?.maxDecimals ?? 4;
  const num = priceToFloat(price);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Classifies the staleness of a price record given its timestamp and current reference time (in seconds).
 */
export function classifyPriceAge(
  timestamp: bigint | null,
  referenceTimeSeconds: number,
  maxAgeSeconds = MAX_ORACLE_AGE_SECONDS
): { status: StalenessStatus; ageSeconds: number | null } {
  if (timestamp === null) {
    return { status: "missing", ageSeconds: null };
  }

  const recordTime = Number(timestamp);
  const diffSeconds = referenceTimeSeconds - recordTime;

  if (diffSeconds < 0) {
    return { status: "future", ageSeconds: diffSeconds };
  }

  if (diffSeconds > maxAgeSeconds) {
    return { status: "stale", ageSeconds: diffSeconds };
  }

  return { status: "fresh", ageSeconds: diffSeconds };
}

/**
 * Formats age in seconds into human readable duration ("just now", "12s ago", "5m ago", "2h ago", etc.)
 */
export function formatAge(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 0) return "in the future";
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Simulates a read call to a contract method with arguments.
 */
export async function simulateRead(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  rpcUrl = config.rpc
): Promise<unknown> {
  const server = getServer(rpcUrl);
  const networkPassphrase = (await server.getNetwork()).passphrase;
  const transaction = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(result)) {
    throw new Error(`RPC simulation error for ${method}: ${result.error}`);
  }
  if (!result.result) {
    return null;
  }
  return scValToNative(result.result.retval);
}

/**
 * Fetch the latest ledger close time from RPC getLatestLedger (falling back to Date.now() / 1000).
 */
export async function getReferenceTime(
  rpcUrl = config.rpc
): Promise<{ timeSeconds: number; source: "ledger" | "browser" }> {
  try {
    const server = getServer(rpcUrl);
    const latest = await server.getLatestLedger();
    const rawTime = (latest as { closeTime?: string | number }).closeTime;
    if (rawTime !== undefined && rawTime !== null) {
      const parsed = typeof rawTime === "number" ? rawTime : parseInt(String(rawTime), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return { timeSeconds: parsed, source: "ledger" };
      }
    }
  } catch {
    // fallback
  }
  return { timeSeconds: Math.floor(Date.now() / 1000), source: "browser" };
}

/**
 * Fetch get_price_record(asset) from the lending contract.
 */
export async function getPriceRecord(
  assetAddress: string,
  contractId = config.lendingId,
  rpcUrl = config.rpc
): Promise<PriceRecord | null> {
  if (!contractId || !assetAddress) return null;
  try {
    const assetScVal = new Address(assetAddress).toScVal();
    const raw = await simulateRead(contractId, "get_price_record", [assetScVal], rpcUrl);
    return decodePriceRecord(raw);
  } catch {
    return null;
  }
}

/**
 * Fetch get_price_bounds(asset) from the lending contract.
 */
export async function getPriceBounds(
  assetAddress: string,
  contractId = config.lendingId,
  rpcUrl = config.rpc
): Promise<PriceBounds> {
  if (!contractId || !assetAddress) return { min: null, max: null };
  try {
    const assetScVal = new Address(assetAddress).toScVal();
    const raw = await simulateRead(contractId, "get_price_bounds", [assetScVal], rpcUrl);
    return decodePriceBounds(raw);
  } catch {
    return { min: null, max: null };
  }
}

/**
 * Fetch get_collateral_asset() from the lending contract if available.
 */
export async function getCollateralAsset(
  contractId = config.lendingId,
  rpcUrl = config.rpc
): Promise<string | null> {
  if (!contractId) return null;
  try {
    const raw = await simulateRead(contractId, "get_collateral_asset", [], rpcUrl);
    if (typeof raw === "string" && raw.length > 0) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * High-level helper: reads oracle records, bounds, and classifies staleness against latest ledger time.
 */
export async function fetchOracleAssetPrices(options?: {
  contractId?: string;
  rpcUrl?: string;
  additionalAssetIds?: string[];
}): Promise<{
  prices: Record<string, OracleAssetPrice>;
  timeSource: "ledger" | "browser";
  referenceTimeSeconds: number;
}> {
  const contractId = options?.contractId ?? config.lendingId;
  const rpcUrl = options?.rpcUrl ?? config.rpc;

  const { timeSeconds, source } = await getReferenceTime(rpcUrl);

  const assetList: string[] = [];
  if (config.tokenId) {
    assetList.push(config.tokenId);
  }
  if (options?.additionalAssetIds) {
    for (const a of options.additionalAssetIds) {
      if (a && !assetList.includes(a)) assetList.push(a);
    }
  }

  // Also query collateral asset
  const collateralAsset = await getCollateralAsset(contractId, rpcUrl);
  if (collateralAsset && !assetList.includes(collateralAsset)) {
    assetList.push(collateralAsset);
  }

  const results: Record<string, OracleAssetPrice> = {};

  await Promise.all(
    assetList.map(async (assetId) => {
      try {
        const [record, bounds] = await Promise.all([
          getPriceRecord(assetId, contractId, rpcUrl),
          getPriceBounds(assetId, contractId, rpcUrl),
        ]);

        if (!record) {
          results[assetId] = {
            assetId,
            symbol: assetId.slice(0, 4),
            price: null,
            priceNumber: null,
            timestamp: null,
            ageSeconds: null,
            status: "missing",
            bounds,
            source: "demo",
          };
          return;
        }

        const { status, ageSeconds } = classifyPriceAge(record.timestamp, timeSeconds);

        results[assetId] = {
          assetId,
          symbol: assetId.slice(0, 4),
          price: record.price,
          priceNumber: priceToFloat(record.price),
          timestamp: record.timestamp,
          ageSeconds,
          status,
          bounds,
          source: "oracle",
        };
      } catch {
        results[assetId] = {
          assetId,
          symbol: assetId.slice(0, 4),
          price: null,
          priceNumber: null,
          timestamp: null,
          ageSeconds: null,
          status: "missing",
          bounds: { min: null, max: null },
          source: "demo",
        };
      }
    })
  );

  return {
    prices: results,
    timeSource: source,
    referenceTimeSeconds: timeSeconds,
  };
}
