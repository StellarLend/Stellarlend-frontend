import {
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  scValToNative,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";
import type { TwapObservation } from "./twap";

export type ReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type TokenInfo = {
  decimals: number;
  symbol?: string;
  name?: string;
};

export type PoolSnapshot = {
  reserves: ReadResult<[bigint, bigint]>;
  spotPriceAB: ReadResult<string>; // 1 token A = ? token B
  spotPriceBA: ReadResult<string>; // 1 token B = ? token A
  feeBps: ReadResult<number>;
  maxImpactBps: ReadResult<number | "disabled">;
  minSwapIn: ReadResult<bigint>;
  minLiquidity: ReadResult<bigint>;
  totalSupply: ReadResult<bigint>;
  accruedFees: ReadResult<[bigint, bigint]>;
  isFlashActive: ReadResult<boolean>;
  twapObservations: ReadResult<TwapObservation[]>;
  tokenAInfo: ReadResult<TokenInfo>;
  tokenBInfo: ReadResult<TokenInfo>;
};

const NETWORK_PASSPHRASE = config.networkPassphrase;
export const MAX_IMPACT_SENTINEL = 4294967295; // u32::MAX (guard disabled)

// Validates a Stellar StrKey contract address (starts with 'C', 56 uppercase alphanumeric chars)
export function isValidContractAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  return /^C[A-Z0-9]{55}$/.test(address);
}

function getRpcServer(): rpc.Server {
  return new rpc.Server(config.rpc);
}

// Dummy account used for Soroban read-only transaction simulation without wallet connection
const DUMMY_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

/**
 * Generic read-only call using simulateTransaction (invokeHostFunction).
 * Does not require wallet connection or transaction signing.
 */
export async function simulateRead<T>(
  contractId: string,
  method: string,
  args: ReturnType<typeof nativeToScVal>[] = [],
  customServer?: rpc.Server
): Promise<T> {
  const server = customServer || getRpcServer();
  let source;
  try {
    source = await server.getAccount(DUMMY_SOURCE);
  } catch {
    const { Account } = await import("@stellar/stellar-sdk");
    source = new Account(DUMMY_SOURCE, "0");
  }

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error || `Simulation error calling ${method}`);
  }
  if (!simulation.result) {
    throw new Error(`Soroban RPC did not return a value for ${method}.`);
  }
  return scValToNative(simulation.result.retval) as T;
}

function calculateSpotPrice(reserveIn: bigint, reserveOut: bigint, decIn: number, decOut: number): string {
  if (reserveIn <= 0n || reserveOut <= 0n) return "-";
  const scaleIn = 10n ** BigInt(decIn);
  const scaleOut = 10n ** BigInt(decOut);
  const precision = 6n;
  const factor = 10n ** precision;
  const scaled = (reserveOut * scaleIn * factor) / (reserveIn * scaleOut);
  const whole = scaled / factor;
  const frac = (scaled % factor).toString().padStart(Number(precision), "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/**
 * Reads the comprehensive AMM pool state concurrently with Promise.allSettled.
 * If individual calls fail, their specific field returns { ok: false, error }.
 */
export async function getPoolSnapshot(
  ammContractId?: string,
  tokenAId?: string,
  tokenBId?: string,
  customServer?: rpc.Server
): Promise<PoolSnapshot> {
  const ammId = ammContractId || config.ammId;
  const tAId = tokenAId || config.ammTokenAId;
  const tBId = tokenBId || config.ammTokenBId;

  if (!ammId || !isValidContractAddress(ammId)) {
    throw new Error("Invalid or unconfigured AMM contract ID.");
  }

  const read = <T>(contract: string, method: string, args: ReturnType<typeof nativeToScVal>[] = []) =>
    simulateRead<T>(contract, method, args, customServer);

  const [
    reservesRes,
    feeBpsRes,
    maxImpactRes,
    minSwapInRes,
    minLiquidityRes,
    totalSupplyRes,
    accruedFeesRes,
    isFlashActiveRes,
    twapObsRes,
    tokenADecimalsRes,
    tokenBDecimalsRes,
  ] = await Promise.allSettled([
    read<[unknown, unknown] | unknown[]>(ammId, "get_reserves"),
    read<number | bigint>(ammId, "get_fee_bps"),
    read<number | bigint>(ammId, "get_max_impact_bps"),
    read<bigint>(ammId, "get_min_swap_in"),
    read<bigint>(ammId, "get_min_liquidity"),
    read<bigint>(ammId, "get_total_supply"),
    read<[unknown, unknown] | unknown[]>(ammId, "get_accrued_fees"),
    read<boolean>(ammId, "is_flash_active"),
    read<Array<[unknown, unknown, unknown]>>(ammId, "get_twap_observations"),
    tAId && isValidContractAddress(tAId) ? read<number | bigint>(tAId, "decimals") : Promise.reject(new Error("Token A ID unset")),
    tBId && isValidContractAddress(tBId) ? read<number | bigint>(tBId, "decimals") : Promise.reject(new Error("Token B ID unset")),
  ]);

  // Decode Reserves
  let decodedReserves: ReadResult<[bigint, bigint]>;
  if (reservesRes.status === "fulfilled" && Array.isArray(reservesRes.value) && reservesRes.value.length === 2) {
    decodedReserves = {
      ok: true,
      value: [BigInt(reservesRes.value[0] as bigint), BigInt(reservesRes.value[1] as bigint)],
    };
  } else {
    decodedReserves = {
      ok: false,
      error: reservesRes.status === "rejected" ? reservesRes.reason?.message ?? "Failed to read reserves" : "Invalid reserve data",
    };
  }

  // Decode Accrued Fees
  let decodedAccruedFees: ReadResult<[bigint, bigint]>;
  if (accruedFeesRes.status === "fulfilled" && Array.isArray(accruedFeesRes.value) && accruedFeesRes.value.length === 2) {
    decodedAccruedFees = {
      ok: true,
      value: [BigInt(accruedFeesRes.value[0] as bigint), BigInt(accruedFeesRes.value[1] as bigint)],
    };
  } else {
    decodedAccruedFees = {
      ok: false,
      error: accruedFeesRes.status === "rejected" ? accruedFeesRes.reason?.message ?? "Failed to read accrued fees" : "Invalid fee data",
    };
  }

  // Token Decimals
  const decA = tokenADecimalsRes.status === "fulfilled" ? Number(tokenADecimalsRes.value) : 7;
  const decB = tokenBDecimalsRes.status === "fulfilled" ? Number(tokenBDecimalsRes.value) : 7;

  // Spot Prices
  let spotPriceAB: ReadResult<string>;
  let spotPriceBA: ReadResult<string>;
  if (decodedReserves.ok) {
    const [resA, resB] = decodedReserves.value;
    spotPriceAB = { ok: true, value: calculateSpotPrice(resA, resB, decA, decB) };
    spotPriceBA = { ok: true, value: calculateSpotPrice(resB, resA, decB, decA) };
  } else {
    spotPriceAB = { ok: false, error: decodedReserves.error };
    spotPriceBA = { ok: false, error: decodedReserves.error };
  }

  // Fee BPS
  const feeBps: ReadResult<number> = feeBpsRes.status === "fulfilled"
    ? { ok: true, value: Number(feeBpsRes.value) }
    : { ok: false, error: feeBpsRes.reason?.message ?? "Failed to read fee" };

  // Max Impact Guard
  let maxImpactBps: ReadResult<number | "disabled">;
  if (maxImpactRes.status === "fulfilled") {
    const val = Number(maxImpactRes.value);
    maxImpactBps = { ok: true, value: val === MAX_IMPACT_SENTINEL ? "disabled" : val };
  } else {
    maxImpactBps = { ok: false, error: maxImpactRes.reason?.message ?? "Failed to read max impact" };
  }

  // Min Swap In
  const minSwapIn: ReadResult<bigint> = minSwapInRes.status === "fulfilled"
    ? { ok: true, value: BigInt(minSwapInRes.value) }
    : { ok: false, error: minSwapInRes.reason?.message ?? "Failed to read min swap in" };

  // Min Liquidity Floor
  const minLiquidity: ReadResult<bigint> = minLiquidityRes.status === "fulfilled"
    ? { ok: true, value: BigInt(minLiquidityRes.value) }
    : { ok: false, error: minLiquidityRes.reason?.message ?? "Failed to read min liquidity" };

  // Total Supply
  const totalSupply: ReadResult<bigint> = totalSupplyRes.status === "fulfilled"
    ? { ok: true, value: BigInt(totalSupplyRes.value) }
    : { ok: false, error: totalSupplyRes.reason?.message ?? "Failed to read total supply" };

  // Flash Swap Active
  const isFlashActive: ReadResult<boolean> = isFlashActiveRes.status === "fulfilled"
    ? { ok: true, value: Boolean(isFlashActiveRes.value) }
    : { ok: false, error: isFlashActiveRes.reason?.message ?? "Failed to read flash lock status" };

  // TWAP Observations buffer Vec<(timestamp, cum_num, cum_denom)>
  let twapObservations: ReadResult<TwapObservation[]>;
  if (twapObsRes.status === "fulfilled" && Array.isArray(twapObsRes.value)) {
    const parsed: TwapObservation[] = twapObsRes.value.map((item) => {
      if (Array.isArray(item)) {
        return {
          timestamp: BigInt(item[0] as bigint),
          cumNum: BigInt(item[1] as bigint),
          cumDenom: BigInt(item[2] as bigint),
        };
      }
      return {
        timestamp: BigInt((item as Record<string, unknown>).timestamp as bigint),
        cumNum: BigInt((item as Record<string, unknown>).cum_num as bigint),
        cumDenom: BigInt((item as Record<string, unknown>).cum_denom as bigint),
      };
    });
    twapObservations = { ok: true, value: parsed };
  } else {
    twapObservations = {
      ok: false,
      error: twapObsRes.status === "rejected" ? twapObsRes.reason?.message ?? "Failed to read TWAP observations" : "Invalid observations",
    };
  }

  // Token Info
  const tokenAInfo: ReadResult<TokenInfo> = tokenADecimalsRes.status === "fulfilled"
    ? { ok: true, value: { decimals: Number(tokenADecimalsRes.value), symbol: "Token A" } }
    : { ok: false, error: tokenADecimalsRes.reason?.message ?? "Token A decimals unavailable" };

  const tokenBInfo: ReadResult<TokenInfo> = tokenBDecimalsRes.status === "fulfilled"
    ? { ok: true, value: { decimals: Number(tokenBDecimalsRes.value), symbol: "Token B" } }
    : { ok: false, error: tokenBDecimalsRes.reason?.message ?? "Token B decimals unavailable" };

  return {
    reserves: decodedReserves,
    spotPriceAB,
    spotPriceBA,
    feeBps,
    maxImpactBps,
    minSwapIn,
    minLiquidity,
    totalSupply,
    accruedFees: decodedAccruedFees,
    isFlashActive,
    twapObservations,
    tokenAInfo,
    tokenBInfo,
  };
}
