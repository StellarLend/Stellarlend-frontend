import {
  Account,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

export const BPS_DENOM = 10_000n;
export const DEFAULT_APR_BPS = 500n;
export const I128_MAX = (1n << 127n) - 1n;
export const UTILIZATION_HISTORY_CAPACITY = 256;

const SIMULATION_SOURCE =
  "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";

/**
 * Configuration parameters for the two-slope kink interest-rate model with
 * an optional emergency surcharge band at high utilization.
 *
 * Ported from `stellar-lend/contracts/lending/src/rate_model.rs` L16-L111 (`RateParams` & `Default`).
 */
export type RateParams = {
  base_rate_bps: bigint;
  kink_utilization_bps: bigint;
  multiplier_bps: bigint;
  jump_multiplier_bps: bigint;
  rate_floor_bps: bigint;
  rate_ceiling_bps: bigint;
  max_rate_change_per_ledger_bps: bigint;
  hysteresis_bps: bigint;
  surcharge_kink_bps: bigint;
  surcharge_slope: bigint;
};

/**
 * Accepts bigint or number fields when calling `borrowRateBps`.
 */
export type RateParamsInput = {
  [K in keyof RateParams]: bigint | number;
};

/**
 * Default rate model configuration (`RateParams::default()` in `rate_model.rs` L75-L111).
 */
export const DEFAULT_RATE_PARAMS: RateParams = {
  base_rate_bps: 100n,
  kink_utilization_bps: 8_000n,
  multiplier_bps: 2_000n,
  jump_multiplier_bps: 10_000n,
  rate_floor_bps: 50n,
  rate_ceiling_bps: 10_000n,
  max_rate_change_per_ledger_bps: I128_MAX,
  hysteresis_bps: 0n,
  surcharge_kink_bps: 10_000n,
  surcharge_slope: 0n,
};

/**
 * Structured, read-only diagnostics for the borrow-rate pipeline.
 * Ported from `stellar-lend/contracts/lending/src/lib.rs` L673-L689 (`RateModelDiagnostics`).
 */
export type RateModelDiagnostics = {
  rate_model_active: boolean;
  utilization_bps: bigint;
  target_rate_bps: bigint;
  applied_rate_bps: bigint;
  last_update_ledger: number;
  elapsed_ledgers: number;
};

/**
 * Point-in-time protocol utilization sample from the contract ring buffer.
 * Ported from `stellar-lend/contracts/lending/src/lib.rs` L660-L666 (`UtilizationSample`).
 */
export type UtilizationSample = {
  ledger: number;
  utilization_bps: bigint;
};

export type RateCurvePoint = {
  utilizationBps: bigint;
  borrowRateBps: bigint;
};

export type RateModelSnapshot = {
  params: RateParams;
  diagnostics: RateModelDiagnostics;
  history: UtilizationSample[];
  source: "contract" | "demo";
};

function toBigIntStrict(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid non-finite number for ${field}`);
    }
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error(`Invalid integer string for ${field}`);
    }
    return BigInt(trimmed);
  }
  throw new Error(`Invalid value for ${field}`);
}

function toNonNegativeU32(value: unknown, field: string): number {
  const big = toBigIntStrict(value, field);
  if (big < 0n || big > 0xffff_ffffn) {
    throw new Error(`Out-of-range u32 for ${field}`);
  }
  return Number(big);
}

function clampBigInt(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function unwrapScVal(raw: unknown): unknown {
  if (raw instanceof xdr.ScVal) {
    return scValToNative(raw as unknown as xdr.ScVal);
  }
  if (
    raw &&
    typeof raw === "object" &&
    "switch" in raw &&
    typeof (raw as { switch?: unknown }).switch === "function"
  ) {
    return scValToNative(raw as unknown as xdr.ScVal);
  }
  return raw;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  const unwrapped = unwrapScVal(raw);
  if (!unwrapped || typeof unwrapped !== "object" || Array.isArray(unwrapped)) {
    return null;
  }
  return unwrapped as Record<string, unknown>;
}

/**
 * Pure two-slope borrow-rate formula with optional emergency surcharge band and
 * floor/ceiling clamping.
 *
 * Ported directly from `compute_borrow_rate` in
 * `stellar-lend/contracts/lending/src/rate_model.rs` L213-L280:
 * - Pre-kink component (L233-L243):
 *   `pre_kink_rate = base_rate_bps + (min(u, kink_utilization_bps) * multiplier_bps) / BPS_DENOM`
 * - Post-kink jump component (L245-L259):
 *   if `u > kink_utilization_bps`: `jump = ((u - kink_utilization_bps) * jump_multiplier_bps) / BPS_DENOM`
 * - Emergency surcharge band (L261-L275):
 *   if `u > surcharge_kink_bps`: `surcharge = ((u - surcharge_kink_bps) * surcharge_slope) / BPS_DENOM`
 * - Floor & ceiling clamp (L277-L279):
 *   `max(rate_floor_bps, min(rate_with_surcharge, rate_ceiling_bps))`
 *
 * Defensive UI boundary handling:
 * - Utilization is clamped to `[0, 10_000]` bps before evaluation so out-of-bounds
 *   inputs never produce unbounded rates.
 * - Uses `bigint` arithmetic so division truncates toward zero exactly like Rust's `i128`.
 */
export function borrowRateBps(
  utilBps: bigint | number,
  params: RateParamsInput = DEFAULT_RATE_PARAMS
): bigint {
  const rawU = toBigIntStrict(utilBps, "utilBps");
  const u = clampBigInt(rawU, 0n, BPS_DENOM);

  const baseRate = toBigIntStrict(params.base_rate_bps, "base_rate_bps");
  const kinkUtil = toBigIntStrict(
    params.kink_utilization_bps,
    "kink_utilization_bps"
  );
  const multiplier = toBigIntStrict(params.multiplier_bps, "multiplier_bps");
  const jumpMultiplier = toBigIntStrict(
    params.jump_multiplier_bps,
    "jump_multiplier_bps"
  );
  const rateFloor = toBigIntStrict(params.rate_floor_bps, "rate_floor_bps");
  const rateCeiling = toBigIntStrict(
    params.rate_ceiling_bps,
    "rate_ceiling_bps"
  );
  const maxRateChange = toBigIntStrict(
    params.max_rate_change_per_ledger_bps,
    "max_rate_change_per_ledger_bps"
  );
  const hysteresis = toBigIntStrict(params.hysteresis_bps, "hysteresis_bps");
  const surchargeKink = toBigIntStrict(
    params.surcharge_kink_bps,
    "surcharge_kink_bps"
  );
  const surchargeSlope = toBigIntStrict(
    params.surcharge_slope,
    "surcharge_slope"
  );

  if (
    baseRate < 0n ||
    kinkUtil < 0n ||
    multiplier < 0n ||
    jumpMultiplier < 0n ||
    rateFloor < 0n ||
    rateCeiling < 0n ||
    maxRateChange < 0n ||
    hysteresis < 0n ||
    surchargeKink < 0n ||
    surchargeSlope < 0n
  ) {
    throw new RangeError("Rate model coefficients must be non-negative");
  }

  const effectivePreKinkUtil = u < kinkUtil ? u : kinkUtil;
  const preKinkRate =
    baseRate + (effectivePreKinkUtil * multiplier) / BPS_DENOM;

  const rawRate =
    u > kinkUtil
      ? preKinkRate + ((u - kinkUtil) * jumpMultiplier) / BPS_DENOM
      : preKinkRate;

  const rateWithSurcharge =
    u > surchargeKink
      ? rawRate + ((u - surchargeKink) * surchargeSlope) / BPS_DENOM
      : rawRate;

  const afterFloor =
    rateWithSurcharge > rateFloor ? rateWithSurcharge : rateFloor;
  return afterFloor < rateCeiling ? afterFloor : rateCeiling;
}

/**
 * Sample the two-slope borrow-rate curve across `0..=10_000` bps, always
 * including `0`, `kink_utilization_bps`, `surcharge_kink_bps` (if in range),
 * and `10_000` so sharp slope transitions are rendered accurately.
 */
export function sampleBorrowRateCurve(
  params: RateParamsInput = DEFAULT_RATE_PARAMS,
  stepBps: bigint | number = 250n
): RateCurvePoint[] {
  const step = toBigIntStrict(stepBps, "stepBps");
  if (step <= 0n) {
    throw new RangeError("stepBps must be positive");
  }

  const points = new Set<bigint>();
  for (let u = 0n; u <= BPS_DENOM; u += step) {
    points.add(u);
  }
  points.add(0n);
  points.add(BPS_DENOM);

  const kink = clampBigInt(
    toBigIntStrict(params.kink_utilization_bps, "kink_utilization_bps"),
    0n,
    BPS_DENOM
  );
  points.add(kink);

  const surchargeKink = clampBigInt(
    toBigIntStrict(params.surcharge_kink_bps, "surcharge_kink_bps"),
    0n,
    BPS_DENOM
  );
  points.add(surchargeKink);

  const sorted = [...points].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.map((utilizationBps) => ({
    utilizationBps,
    borrowRateBps: borrowRateBps(utilizationBps, params),
  }));
}

/**
 * Decode `RateParams` from a native JS object or Soroban `xdr.ScVal`.
 */
export function decodeRateParams(raw: unknown): RateParams {
  const record = asRecord(raw);
  if (!record) {
    throw new Error("Expected RateParams to be a struct/map object");
  }

  const params: RateParams = {
    base_rate_bps: toBigIntStrict(
      record.base_rate_bps ?? record.baseRateBps,
      "base_rate_bps"
    ),
    kink_utilization_bps: toBigIntStrict(
      record.kink_utilization_bps ?? record.kinkUtilizationBps,
      "kink_utilization_bps"
    ),
    multiplier_bps: toBigIntStrict(
      record.multiplier_bps ?? record.multiplierBps,
      "multiplier_bps"
    ),
    jump_multiplier_bps: toBigIntStrict(
      record.jump_multiplier_bps ?? record.jumpMultiplierBps,
      "jump_multiplier_bps"
    ),
    rate_floor_bps: toBigIntStrict(
      record.rate_floor_bps ?? record.rateFloorBps,
      "rate_floor_bps"
    ),
    rate_ceiling_bps: toBigIntStrict(
      record.rate_ceiling_bps ?? record.rateCeilingBps,
      "rate_ceiling_bps"
    ),
    max_rate_change_per_ledger_bps: toBigIntStrict(
      record.max_rate_change_per_ledger_bps ??
        record.maxRateChangePerLedgerBps,
      "max_rate_change_per_ledger_bps"
    ),
    hysteresis_bps: toBigIntStrict(
      record.hysteresis_bps ?? record.hysteresisBps,
      "hysteresis_bps"
    ),
    surcharge_kink_bps: toBigIntStrict(
      record.surcharge_kink_bps ?? record.surchargeKinkBps,
      "surcharge_kink_bps"
    ),
    surcharge_slope: toBigIntStrict(
      record.surcharge_slope ?? record.surchargeSlope,
      "surcharge_slope"
    ),
  };

  if (
    params.base_rate_bps < 0n ||
    params.kink_utilization_bps < 0n ||
    params.multiplier_bps < 0n ||
    params.jump_multiplier_bps < 0n ||
    params.rate_floor_bps < 0n ||
    params.rate_ceiling_bps < 0n ||
    params.max_rate_change_per_ledger_bps < 0n ||
    params.hysteresis_bps < 0n ||
    params.surcharge_kink_bps < 0n ||
    params.surcharge_slope < 0n
  ) {
    throw new Error("RateParams contains negative coefficient");
  }

  return params;
}

/**
 * Decode `RateModelDiagnostics` from a native JS object or Soroban `xdr.ScVal`.
 * Clamps `utilization_bps` defensively into `[0, 10_000]`.
 */
export function decodeRateModelDiagnostics(
  raw: unknown
): RateModelDiagnostics {
  const record = asRecord(raw);
  if (!record) {
    throw new Error(
      "Expected RateModelDiagnostics to be a struct/map object"
    );
  }

  const activeRaw = record.rate_model_active ?? record.rateModelActive;
  if (typeof activeRaw !== "boolean") {
    throw new Error("Invalid rate_model_active boolean in diagnostics");
  }

  const rawUtil = toBigIntStrict(
    record.utilization_bps ?? record.utilizationBps,
    "utilization_bps"
  );
  const utilization_bps = clampBigInt(rawUtil, 0n, BPS_DENOM);

  const target_rate_bps = toBigIntStrict(
    record.target_rate_bps ?? record.targetRateBps,
    "target_rate_bps"
  );
  const applied_rate_bps = toBigIntStrict(
    record.applied_rate_bps ?? record.appliedRateBps,
    "applied_rate_bps"
  );

  if (target_rate_bps < 0n || applied_rate_bps < 0n) {
    throw new Error("Diagnostics rates must be non-negative");
  }

  const last_update_ledger = toNonNegativeU32(
    record.last_update_ledger ?? record.lastUpdateLedger,
    "last_update_ledger"
  );
  const elapsed_ledgers = toNonNegativeU32(
    record.elapsed_ledgers ?? record.elapsedLedgers,
    "elapsed_ledgers"
  );

  return {
    rate_model_active: activeRaw,
    utilization_bps,
    target_rate_bps,
    applied_rate_bps,
    last_update_ledger,
    elapsed_ledgers,
  };
}

/**
 * Decode `Vec<UtilizationSample>` from a native JS array or Soroban `xdr.ScVal`.
 * Clamps each sample's `utilization_bps` to `[0, 10_000]` and caps length at
 * `UTILIZATION_HISTORY_CAPACITY` (256).
 */
export function decodeUtilizationHistory(raw: unknown): UtilizationSample[] {
  const unwrapped = unwrapScVal(raw);
  if (!Array.isArray(unwrapped)) {
    throw new Error("Expected utilization history to be a Vec/array");
  }

  return unwrapped.slice(0, UTILIZATION_HISTORY_CAPACITY).map((entry, idx) => {
    const record = asRecord(entry);
    if (!record) {
      throw new Error(`Invalid utilization sample at index ${idx}`);
    }
    const ledger = toNonNegativeU32(record.ledger, `history[${idx}].ledger`);
    const rawUtil = toBigIntStrict(
      record.utilization_bps ?? record.utilizationBps,
      `history[${idx}].utilization_bps`
    );
    return {
      ledger,
      utilization_bps: clampBigInt(rawUtil, 0n, BPS_DENOM),
    };
  });
}

export type RateModelReadOptions = {
  contractId?: string;
  rpcUrl?: string;
};

async function simulateContractRead(
  method: string,
  options?: RateModelReadOptions
): Promise<unknown> {
  const contractId = options?.contractId ?? config.lendingId;
  const rpcUrl = options?.rpcUrl ?? config.rpc;
  if (!contractId) {
    throw new Error(
      "Set NEXT_PUBLIC_LENDING_CONTRACT_ID to read rate model data."
    );
  }
  const server = new rpc.Server(rpcUrl);
  const networkPassphrase =
    config.networkPassphrase || (await server.getNetwork()).passphrase;
  const transaction = new TransactionBuilder(
    new Account(SIMULATION_SOURCE, "0"),
    {
      fee: "100",
      networkPassphrase,
    }
  )
    .addOperation(new Contract(contractId).call(method))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(result)) {
    throw new Error(`Could not read ${method}: ${result.error}`);
  }
  if (!result.result) {
    throw new Error(`Could not read ${method}: the RPC returned no result.`);
  }
  return result.result.retval;
}

/**
 * Read `get_rate_params` from the lending contract (`lib.rs` L2558-L2563).
 */
export async function fetchRateParams(
  options?: RateModelReadOptions
): Promise<RateParams> {
  const retval = await simulateContractRead("get_rate_params", options);
  return decodeRateParams(retval);
}

/**
 * Read `get_rate_model_diagnostics` from the lending contract (`lib.rs` L2828-L2866).
 */
export async function fetchRateModelDiagnostics(
  options?: RateModelReadOptions
): Promise<RateModelDiagnostics> {
  const retval = await simulateContractRead(
    "get_rate_model_diagnostics",
    options
  );
  return decodeRateModelDiagnostics(retval);
}

/**
 * Read `get_utilization_history` from the lending contract (`lib.rs` L2816-L2818).
 * Returns newest-first samples (ring buffer capacity 256).
 */
export async function fetchUtilizationHistory(
  options?: RateModelReadOptions
): Promise<UtilizationSample[]> {
  const retval = await simulateContractRead(
    "get_utilization_history",
    options
  );
  return decodeUtilizationHistory(retval);
}

/**
 * Build a deterministic demo snapshot when the contract is not deployed or
 * unreachable, so the rate-model chart remains inspectable in demo mode.
 */
export function buildDemoRateModelSnapshot(
  utilizationBps: bigint = 6_500n
): RateModelSnapshot {
  const clampedUtil = clampBigInt(utilizationBps, 0n, BPS_DENOM);
  const targetRate = borrowRateBps(clampedUtil, DEFAULT_RATE_PARAMS);
  return {
    params: DEFAULT_RATE_PARAMS,
    diagnostics: {
      rate_model_active: true,
      utilization_bps: clampedUtil,
      target_rate_bps: targetRate,
      applied_rate_bps: targetRate,
      last_update_ledger: 512_400,
      elapsed_ledgers: 0,
    },
    history: [
      { ledger: 512_400, utilization_bps: clampedUtil },
      { ledger: 512_380, utilization_bps: 6_200n },
      { ledger: 512_360, utilization_bps: 5_800n },
      { ledger: 512_340, utilization_bps: 6_100n },
      { ledger: 512_320, utilization_bps: 5_400n },
      { ledger: 512_300, utilization_bps: 4_900n },
    ],
    source: "demo",
  };
}

/**
 * Read rate parameters, diagnostics, and utilization history in parallel,
 * falling back to the demo snapshot when no contract ID is configured.
 */
export async function fetchRateModelSnapshot(
  options?: RateModelReadOptions & { fallbackUtilizationBps?: bigint }
): Promise<RateModelSnapshot> {
  const contractId = options?.contractId ?? config.lendingId;
  if (!contractId) {
    return buildDemoRateModelSnapshot(options?.fallbackUtilizationBps);
  }

  const [params, diagnostics, history] = await Promise.all([
    fetchRateParams(options),
    fetchRateModelDiagnostics(options),
    fetchUtilizationHistory(options),
  ]);

  return {
    params,
    diagnostics,
    history,
    source: "contract",
  };
}

/**
 * Format basis points as a percentage string (e.g. `1700n` -> `"17.00%"`).
 */
export function formatBpsPercent(bps: bigint | number, digits = 2): string {
  const numeric = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(numeric / 100).toFixed(digits)}%`;
}
