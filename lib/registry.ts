export interface FeeSchedule {
  lendFeeBps: number;
  borrowFeeBps: number;
  repayFeeBps: number;
  minFeeAmount: number;
}

export interface Market {
  id: string;
  asset: string;
  name: string;
  feeSchedule: FeeSchedule;
}

/**
 * Protocol fee markets keyed by lowercase market id.
 * Must cover every canonical ASSET_SYMBOLS entry (XLM, USDC, BTC, ETH).
 */
export const marketsRegistry: Record<string, Market> = {
  xlm: {
    id: 'xlm',
    asset: 'XLM',
    name: 'Stellar Lumens',
    feeSchedule: { lendFeeBps: 10, borrowFeeBps: 20, repayFeeBps: 5, minFeeAmount: 0.1 },
  },
  usdc: {
    id: 'usdc',
    asset: 'USDC',
    name: 'USDC Coin',
    feeSchedule: { lendFeeBps: 15, borrowFeeBps: 25, repayFeeBps: 10, minFeeAmount: 0.5 },
  },
  btc: {
    id: 'btc',
    asset: 'BTC',
    name: 'Bitcoin',
    // Slightly higher bps for scarcer collateral; min fee in BTC units.
    feeSchedule: { lendFeeBps: 12, borrowFeeBps: 22, repayFeeBps: 8, minFeeAmount: 0.00001 },
  },
  eth: {
    id: 'eth',
    asset: 'ETH',
    name: 'Ether',
    feeSchedule: { lendFeeBps: 12, borrowFeeBps: 22, repayFeeBps: 8, minFeeAmount: 0.0001 },
  },
};

/**
 * Returns a market definition by its ID.
 */
export function getMarket(marketId: string): Market | undefined {
  return marketsRegistry[marketId.toLowerCase()];
}
