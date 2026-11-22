import config from '@/lib/config';
import { httpPost } from '@/lib/http/client';

const HEALTH_FACTOR_SCALE = 10000n;
const BPS_SCALE = 10000n;

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
 * Fetches liquidation parameters from the contract.
 */
export async function getLiquidationParams(): Promise<LiquidationParams> {
  const contractId = config.stellar.sorobanContractId;
  if (!contractId) {
    throw new Error('Soroban contract ID not configured');
  }

  const rpcUrl = config.stellar.sorobanRpcUrl;
  if (!rpcUrl) {
    throw new Error('Soroban RPC URL not configured');
  }

  const responses = await Promise.all([
    readContractMethod(rpcUrl, contractId, 'get_liquidation_threshold_bps'),
    readContractMethod(rpcUrl, contractId, 'get_close_factor_bps'),
    readContractMethod(rpcUrl, contractId, 'get_liquidation_incentive_bps'),
    readContractMethod(rpcUrl, contractId, 'get_liquidation_grace_period'),
  ]);

  return {
    liquidationThresholdBps: BigInt(responses[0] || '0'),
    closeFactorBps: BigInt(responses[1] || '0'),
    liquidationIncentiveBps: BigInt(responses[2] || '0'),
    gracePeriodSeconds: Number(responses[3] || '0'),
  };
}

/**
 * Fetches a borrower's position from the contract.
 * Note: This is a simplified implementation. In production, use the Stellar SDK
 * to build proper Soroban transactions for contract reads.
 */
export async function getBorrowerPosition(borrower: string): Promise<BorrowerPosition> {
  // For now, return mock data to allow the UI to function
  // In production, this would build a proper Soroban transaction and simulate it
  // Using different mock data based on address to simulate different states
  if (borrower.startsWith('GB')) {
    // Unhealthy position (liquidatable)
    return {
      collateralAmount: 2000n,
      debtAmount: 1000n,
      healthFactor: 8000n, // < 10000 = unhealthy
      lastUpdateTimestamp: Math.floor(Date.now() / 1000) - 4000, // 4000 seconds ago
    };
  } else if (borrower.startsWith('GC')) {
    // Healthy position
    return {
      collateralAmount: 5000n,
      debtAmount: 1000n,
      healthFactor: 15000n, // > 10000 = healthy
      lastUpdateTimestamp: Math.floor(Date.now() / 1000),
    };
  }

  // Default: no debt
  return {
    collateralAmount: 0n,
    debtAmount: 0n,
    healthFactor: 100_000_000n, // Sentinel for no debt
    lastUpdateTimestamp: 0,
  };
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

/**
 * Reads a contract method via Soroban RPC.
 * Note: This is a simplified implementation. In production, use the Stellar SDK
 * to build proper XDR transactions for contract reads.
 */
async function readContractMethod(
  rpcUrl: string,
  contractId: string,
  method: string,
  args: Array<{ type: string; value: string }> = [],
): Promise<string> {
  // For now, return mock values to allow the UI to function
  // In production, this would build a proper Soroban transaction and simulate it
  switch (method) {
    case 'get_liquidation_threshold_bps':
      return '8500';
    case 'get_close_factor_bps':
      return '5000';
    case 'get_liquidation_incentive_bps':
      return '500';
    case 'get_liquidation_grace_period':
      return '3600';
    default:
      return '0';
  }
}

/**
 * Builds a simple invoke transaction for reading contract state.
 * Note: This is a placeholder. In production, use the Stellar SDK to build proper XDR.
 */
function buildInvokeTransaction(
  contractId: string,
  method: string,
  args: Array<{ type: string; value: string }>,
): string {
  // For now, return empty string as placeholder
  // The actual implementation would use @stellar/stellar-sdk to build XDR
  return '';
}
