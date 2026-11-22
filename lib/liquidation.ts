import { Address, scValToNative, type xdr } from "@stellar/stellar-sdk";
import { config, isValidContractAddress } from "@/lib/config";
import { ContractNotConfiguredError } from "@/lib/api/errors";
import { simulateRead } from "@/lib/soroban-read";

const HEALTH_FACTOR_SCALE = 10000n;
const BPS_SCALE = 10000n;
const LIQUIDATION_PARAMS_CACHE_TTL_MS = 30_000;

export interface LiquidationParams {
  liquidationThresholdBps: bigint;
  closeFactorBps: bigint;
  liquidationIncentiveBps: bigint;
  gracePeriodSeconds: number;
}

export interface BorrowerPosition {
  collateralAmount: bigint;
  debtAmount: bigint;
  healthFactor: bigint;
  lastUpdateTimestamp: number;
}

export interface LiquidationPreview {
  actualRepay: bigint;
  seizedEstimate: bigint;
}

export interface LiquidationPreviewInput {
  debt: bigint;
  collateral: bigint;
  closeFactorBps: bigint;
  incentiveBps: bigint;
  amount: bigint;
}

/**
 * ScVals returned by the lending contract's liquidation parameter getters:
 * `get_liquidation_threshold_bps`, `get_close_factor_bps`,
 * `get_liquidation_incentive_bps` and `get_liquidation_grace_period`.
 */
export interface LiquidationParamsScVals {
  liquidationThresholdBps: xdr.ScVal;
  closeFactorBps: xdr.ScVal;
  liquidationIncentiveBps: xdr.ScVal;
  gracePeriodSeconds: xdr.ScVal;
}

interface CachedLiquidationParams {
  value: LiquidationParams;
  expiresAt: number;
}

let liquidationParamsCache: CachedLiquidationParams | null = null;

/**
 * Clears the module-scope liquidation params cache.
 * Intended for tests; the cache otherwise expires after 30 seconds.
 */
export function resetLiquidationParamsCache(): void {
  liquidationParamsCache = null;
}

function requireLendingContractId(): string {
  const contractId = config.lendingId;
  if (!contractId || !isValidContractAddress(contractId)) {
    throw new ContractNotConfiguredError();
  }
  return contractId;
}

async function readContractValue(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<xdr.ScVal> {
  const { scVal } = await simulateRead({
    contractId,
    method,
    args,
    rpcUrl: config.rpc,
    passphrase: config.networkPassphrase,
  });
  return scVal;
}

function describeNative(value: unknown): string {
  if (typeof value === "bigint") return `${value}n`;
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `${typeof value} ${JSON.stringify(value)}`;
}

function scValToNativeField(scVal: xdr.ScVal, field: string): unknown {
  try {
    return scValToNative(scVal);
  } catch {
    throw new Error(`Malformed ${field}: unable to decode ScVal`);
  }
}

function toInteger(value: unknown, field: string, context: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error(`Malformed ${context}: ${field} is not an integer (got ${describeNative(value)})`);
}

function toSeconds(value: unknown, field: string, context: string): number {
  const seconds = toInteger(value, field, context);
  if (seconds < 0n || seconds > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Malformed ${context}: ${field} is outside the safe integer range (got ${seconds}n)`);
  }
  return Number(seconds);
}

function readField(record: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    const value = record[name];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function requireBigIntField(
  record: Record<string, unknown>,
  names: string[],
  field: string,
): bigint {
  const value = readField(record, names);
  if (value === undefined) {
    throw new Error(`Malformed position: missing ${field}`);
  }
  return toInteger(value, field, "position");
}

/**
 * Decodes the four liquidation getters into {@link LiquidationParams}.
 * Every basis-point field is a bigint; only the grace period is a number.
 */
export function decodeLiquidationParams(scVals: LiquidationParamsScVals): LiquidationParams {
  const context = "liquidation params";
  return {
    liquidationThresholdBps: toInteger(
      scValToNativeField(scVals.liquidationThresholdBps, "liquidationThresholdBps"),
      "liquidationThresholdBps",
      context,
    ),
    closeFactorBps: toInteger(
      scValToNativeField(scVals.closeFactorBps, "closeFactorBps"),
      "closeFactorBps",
      context,
    ),
    liquidationIncentiveBps: toInteger(
      scValToNativeField(scVals.liquidationIncentiveBps, "liquidationIncentiveBps"),
      "liquidationIncentiveBps",
      context,
    ),
    gracePeriodSeconds: toSeconds(
      scValToNativeField(scVals.gracePeriodSeconds, "gracePeriodSeconds"),
      "gracePeriodSeconds",
      context,
    ),
  };
}

/**
 * Decodes the lending contract's `PositionSummary` (`collateral`, `debt`,
 * `health_factor`) into a {@link BorrowerPosition}.
 *
 * The contract position has no timestamp of its own, so the optional
 * `get_first_unhealthy_timestamp` ScVal supplies `lastUpdateTimestamp`; when it
 * is absent or `None` the position has no recorded unhealthy timestamp (0).
 */
export function decodeBorrowerPosition(
  positionScVal: xdr.ScVal,
  firstUnhealthyAtScVal?: xdr.ScVal | null,
): BorrowerPosition {
  const raw = scValToNativeField(positionScVal, "position");
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `Malformed position: expected a struct ScVal (got ${describeNative(raw)})`,
    );
  }
  const record = raw as Record<string, unknown>;

  let lastUpdateTimestamp = 0;
  if (firstUnhealthyAtScVal) {
    const nativeTimestamp = scValToNativeField(firstUnhealthyAtScVal, "lastUpdateTimestamp");
    if (nativeTimestamp !== null && nativeTimestamp !== undefined) {
      lastUpdateTimestamp = toSeconds(
        nativeTimestamp,
        "lastUpdateTimestamp",
        "position",
      );
    }
  }

  return {
    collateralAmount: requireBigIntField(
      record,
      ["collateral", "collateral_amount", "collateralAmount"],
      "collateralAmount",
    ),
    debtAmount: requireBigIntField(
      record,
      ["debt", "debt_amount", "debtAmount"],
      "debtAmount",
    ),
    healthFactor: requireBigIntField(
      record,
      ["health_factor", "healthFactor"],
      "health_factor",
    ),
    lastUpdateTimestamp,
  };
}

/**
 * Fetches liquidation parameters from the configured lending contract.
 * Successful reads are cached for about 30 seconds.
 */
export async function getLiquidationParams(): Promise<LiquidationParams> {
  const now = Date.now();
  if (liquidationParamsCache && now < liquidationParamsCache.expiresAt) {
    return liquidationParamsCache.value;
  }

  const contractId = requireLendingContractId();
  const [liquidationThresholdBps, closeFactorBps, liquidationIncentiveBps, gracePeriodSeconds] =
    await Promise.all([
      readContractValue(contractId, "get_liquidation_threshold_bps"),
      readContractValue(contractId, "get_close_factor_bps"),
      readContractValue(contractId, "get_liquidation_incentive_bps"),
      readContractValue(contractId, "get_liquidation_grace_period"),
    ]);

  const params = decodeLiquidationParams({
    liquidationThresholdBps,
    closeFactorBps,
    liquidationIncentiveBps,
    gracePeriodSeconds,
  });

  liquidationParamsCache = {
    value: params,
    expiresAt: now + LIQUIDATION_PARAMS_CACHE_TTL_MS,
  };
  return params;
}

/**
 * Fetches a borrower's position from the configured lending contract.
 * The contract's grace clock (`get_first_unhealthy_timestamp`) is read
 * alongside the position; if that read is unavailable it falls back to 0.
 */
export async function getBorrowerPosition(borrower: string): Promise<BorrowerPosition> {
  const contractId = requireLendingContractId();
  const borrowerScVal = new Address(borrower).toScVal();

  const [positionScVal, firstUnhealthyAtScVal] = await Promise.all([
    readContractValue(contractId, "get_position", [borrowerScVal]),
    readContractValue(contractId, "get_first_unhealthy_timestamp", [borrowerScVal]).catch(
      () => null,
    ),
  ]);

  return decodeBorrowerPosition(positionScVal, firstUnhealthyAtScVal);
}

/**
 * Computes the actual repay amount and seized collateral estimate for a liquidation.
 * Mirrors the contract's integer math (floor division, bps denominators).
 */
export function previewLiquidation(input: LiquidationPreviewInput): LiquidationPreview {
  const { debt, collateral, closeFactorBps, incentiveBps, amount } = input;

  // Max repayable amount is debt * closeFactor / 10000 (floor division)
  const maxRepay = (debt * closeFactorBps) / BPS_SCALE;

  // Actual repay is the lesser of requested amount and max repayable
  const actualRepay = amount < maxRepay ? amount : maxRepay;

  // Seized collateral is calculated as:
  // (actualRepay * collateral * (10000 + incentiveBps)) / (debt * 10000)
  // This mirrors the contract's incentive calculation
  if (debt === 0n) {
    return { actualRepay: 0n, seizedEstimate: 0n };
  }

  const seizedEstimate =
    (actualRepay * collateral * (BPS_SCALE + incentiveBps)) / (debt * BPS_SCALE);

  return { actualRepay, seizedEstimate };
}

/**
 * Determines if a position is liquidatable based on health factor and grace period.
 */
export function isPositionLiquidatable(
  position: BorrowerPosition,
  params: LiquidationParams,
  currentTime: number = Date.now(),
): { liquidatable: boolean; reason?: string } {
  // Sentinel value for no debt
  if (position.healthFactor >= 100_000_000n) {
    return { liquidatable: false, reason: 'No debt' };
  }

  // Check if healthy
  if (position.healthFactor >= HEALTH_FACTOR_SCALE) {
    return { liquidatable: false, reason: 'Position is healthy' };
  }

  // Check grace period
  const timeSinceUpdate = currentTime - position.lastUpdateTimestamp * 1000;
  if (timeSinceUpdate < params.gracePeriodSeconds * 1000) {
    return {
      liquidatable: false,
      reason: 'Position is in grace period',
    };
  }

  return { liquidatable: true };
}
