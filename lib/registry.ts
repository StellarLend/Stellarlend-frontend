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

export const marketsRegistry: Record<string, Market> = {
  xlm: {
    id: 'xlm',
    asset: 'XLM',
    name: 'Stellar Lumens',
    feeSchedule: { lendFeeBps: 10, borrowFeeBps: 20, repayFeeBps: 5, minFeeAmount: 0.1 }
  },
  usdc: {
    id: 'usdc',
    asset: 'USDC',
    name: 'USDC Coin',
    feeSchedule: { lendFeeBps: 15, borrowFeeBps: 25, repayFeeBps: 10, minFeeAmount: 0.5 }
  },
  btc: {
    id: 'btc',
    asset: 'BTC',
    name: 'Bitcoin',
    feeSchedule: { lendFeeBps: 8, borrowFeeBps: 15, repayFeeBps: 5, minFeeAmount: 0.0001 }
  },
  eth: {
    id: 'eth',
    asset: 'ETH',
    name: 'Ethereum',
    feeSchedule: { lendFeeBps: 8, borrowFeeBps: 15, repayFeeBps: 5, minFeeAmount: 0.001 }
  }
};

/**
 * Returns a market definition by its ID.
 */
export function getMarket(marketId: string): Market | undefined {
  return marketsRegistry[marketId.toLowerCase()];
}