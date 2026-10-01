import { ASSET_SYMBOLS, type AssetSymbol } from '@/types/enums';
import type { AssetMarket, MarketsResponse } from './types';

// Representative baseline market parameters per asset.
// Used only when USE_MOCK_MARKETS = 'true'.
// These mirror realistic DeFi lending pool conditions on Stellar testnet.
const BASE_MARKETS: Record<AssetSymbol, Omit<AssetMarket, 'asset'>> = {
  XLM:  { supplyApr: 8.5,  borrowApr: 12.0, utilization: 0.71, totalSupply: 2_500_000, totalBorrow: 1_775_000 },
  USDC: { supplyApr: 5.2,  borrowApr: 7.8,  utilization: 0.65, totalSupply: 10_000_000, totalBorrow: 6_500_000 },
  BTC:  { supplyApr: 2.1,  borrowApr: 4.5,  utilization: 0.47, totalSupply: 500_000, totalBorrow: 235_000 },
  ETH:  { supplyApr: 3.8,  borrowApr: 6.2,  utilization: 0.58, totalSupply: 1_200_000, totalBorrow: 696_000 },
};

export interface SorobanReserveData {
  liquidityRate: number;
  variableBorrowRate: number;
  stableBorrowRate: number;
  utilizationRate: number;
  totalSupply: number;
  totalBorrow: number;
}

export interface SorobanRPCClient {
  invokeContract(
    contractId: string,
    method: string,
    args: unknown[],
  ): Promise<unknown>;
}

export interface FetchMarketsOptions {
  client?: SorobanRPCClient;
  contractId?: string;
  rpcUrl?: string;
  useMock?: boolean;
  assetAddresses?: Partial<Record<AssetSymbol, string>>;
  timeoutMs?: number;
}

function resolveUseMock(explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  const env = process.env.USE_MOCK_MARKETS ?? process.env.NEXT_PUBLIC_USE_MOCK_MARKETS;
  if (env === undefined) return false;
  return env.toLowerCase() === 'true' || env === '1';
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid Soroban reserve data field "${field}": ${String(value)}`);
  }
  return value;
}

export function decodeReserveData(rawData: unknown): SorobanReserveData {
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Soroban reserve data response is not an object');
  }
  const data = rawData as Record<string, unknown>;
  const liquidityRate = assertNumber(data.liquidity_rate ?? data.liquidityRate, 'liquidity_rate');
  const variableBorrowRate = assertNumber(
    data.variable_borrow_rate ?? data.variableBorrowRate,
    'variable_borrow_rate',
  );
  const stableBorrowRate = assertNumber(
    data.stable_borrow_rate ?? data.stableBorrowRate ?? variableBorrowRate,
    'stable_borrow_rate',
  );
  const utilizationRate = assertNumber(
    data.utilization_rate ?? data.utilizationRate,
    'utilization_rate',
  );
  const totalSupply = assertNumber(
    data.total_supply ?? data.totalSupply ?? 0,
    'total_supply',
  );
  const totalBorrow = assertNumber(
    data.total_borrow ?? data.totalBorrow ?? 0,
    'total_borrow',
  );
  return { liquidityRate, variableBorrowRate, stableBorrowRate, utilizationRate, totalSupply, totalBorrow };
}

async function fetchFromSoroban(assets: AssetSymbol[], options: FetchMarketsOptions): Promise<MarketsResponse> {
  const contractId = options.contractId ?? process.env.SOROBAN_LENDING_POOL_CONTRACT_ID;
  if (!contractId) {
    throw new Error(
      'SOROBAN_LENDING_POOL_CONTRACT_ID is required to fetch live market data',
    );
  }
  const client = options.client ?? await createSorobanClient(options);
  const markets: AssetMarket[] = [];
  for (const symbol of assets) {
    const assetAddress = options.assetAddresses?.[symbol] ?? assetAddressesUpdated(symbol);
    const raw = await client.invokeContract(contractId, 'get_reserve_data', [assetAddress]);
    const decoded = decodeReserveData(raw);
    markets.push({
      asset: symbol,
      supplyApr: decoded.liquidityRate,
      borrowApr: decoded.variableBorrowRate,
      utilization: decoded.utilizationRate,
      totalSupply: decoded.totalSupply,
      totalBorrow: decoded.totalBorrow,
    });
  }
  return {
    markets,
    timestamp: new Date().toISOString(),
    source: 'Soroban RPC',
  };
}

async function createSorobanClient(options: FetchMarketsOptions): Promise<SorobanRPCClient> {
  const rpcUrl = options.rpcUrl ?? process.env.SOROBAN_RPC_URL;
  if (!rpcUrl) {
    throw new Error('SOROBAN_RPC_URL is required to fetch live market data');
  }
  const module = await import('@stellar/stellar-sdk');
  const { SorobanRpc } = module as unknown as {
    SorobanRpc: { Server: new (url: string) => SorobanRPCClient };
  };
  return new SorobanRpc.Server(rpcUrl);
}

function assetAddressesUpdated(symbol: AssetSymbol): string {
  const map = process.env.SOROBAN_ASSET_ADDRESSES;
  if (map) {
    try {
      const parsed = JSON.parse(map) as Record<string, string>;
      if (parsed[symbol]) return parsed[symbol];
    } catch {
      throw new Error('SOROBAN_ASSET_ADDRESSES must be a JSON object mapping asset symbols to addresses');
    }
  }
  throw new Error(`No Soroban contract address configured for asset ${symbol}`);
}

export async function fetchMarkets(
  assets: AssetSymbol[],
  options: FetchMarketsOptions = {},
): Promise<MarketsResponse> {
  if (resolveUseMock(options.useMock)) {
    return fetchMockMarkets(assets);
  }
  return fetchFromSoroban(assets, options);
}

function fetchMockMarkets(assets: AssetSymbol[]): MarketsResponse {
  const markets: AssetMarket[] = assets.map((symbol) => {
    const base = BASE_MARKETS[symbol];
    const jitter = () => (Math.random() - 0.5) * 0.1;
    return {
      asset: symbol,
      supplyApr: parseFloat((base.supplyApr + jitter()).toFixed(2)),
      borrowApr: parseFloat((base.borrowApr + jitter()).toFixed(2)),
      utilization: parseFloat(
        Math.min(1, Math.max(0, base.utilization + (Math.random() - 0.5) * 0.01)).toFixed(4),
      ),
      totalSupply: base.totalSupply,
      totalBorrow: base.totalBorrow,
    };
  });
  return {
    markets,
    timestamp: new Date().toISOString(),
    source: 'Mock market data (USE_MOCK_MARKETS)',
  };
}

export { ASSET_SYMBOLS };
