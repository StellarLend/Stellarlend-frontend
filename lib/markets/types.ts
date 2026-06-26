import type { AssetSymbol } from '@/types/enums';

export interface AssetMarket {
  asset: AssetSymbol;
  supplyApr: number;
  borrowApr: number;
  utilization: number;
  totalSupply: number;
  totalBorrow: number;
}

export interface MarketsResponse {
  markets: AssetMarket[];
  timestamp: string;
  source: string;
}
