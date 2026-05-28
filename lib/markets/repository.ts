import config from '@/lib/config';
import { ASSET_SYMBOLS, type AssetSymbol } from '@/types/enums';
import type { AssetMarket, MarketsResponse } from './types';

// Representative baseline market parameters per asset.
// These mirror realistic DeFi lending pool conditions on Stellar testnet.
const BASE_MARKETS: Record<AssetSymbol, Omit<AssetMarket, 'asset'>> = {
  XLM:  { supplyApr: 8.5,  borrowApr: 12.0, utilization: 0.71, totalSupply: 2_500_000, totalBorrow: 1_775_000 },
  USDC: { supplyApr: 5.2,  borrowApr: 7.8,  utilization: 0.65, totalSupply: 10_000_000, totalBorrow: 6_500_000 },
  BTC:  { supplyApr: 2.1,  borrowApr: 4.5,  utilization: 0.47, totalSupply: 500_000, totalBorrow: 235_000 },
  ETH:  { supplyApr: 3.8,  borrowApr: 6.2,  utilization: 0.58, totalSupply: 1_200_000, totalBorrow: 696_000 },
};

/**
 * Fetches per-asset market data from the Stellarlend Soroban lending pool contract.
 *
 * Production integration steps:
 *   1. Install `@stellar/stellar-sdk` and import `SorobanRpc`.
 *   2. Point the server at `config.stellar.sorobanRpcUrl` (set via NEXT_PUBLIC_SOROBAN_RPC_URL).
 *   3. Invoke the lending pool contract method `get_reserve_data(asset_address)` for each asset.
 *   4. Set the contract ID via env var: SOROBAN_LENDING_POOL_CONTRACT_ID.
 *   5. Decode the XDR ScVal response to extract liquidity_rate (supplyApr),
 *      stable_borrow_rate / variable_borrow_rate (borrowApr), and
 *      utilization_rate fields.
 *
 * Example (not yet wired up):
 *   const server = new SorobanRpc.Server(config.stellar.sorobanRpcUrl);
 *   const account = await server.getAccount(sourceKeypair.publicKey());
 *   const tx = buildGetReserveDataTx(account, contractId, assetAddress);
 *   const sim = await server.simulateTransaction(tx);
 *   const result = decodeReserveData(sim.result.retval);
 *
 * Current implementation: documented stub returning representative values with
 * small random variation to simulate live on-chain fluctuation.
 */
export async function fetchMarkets(assets: AssetSymbol[]): Promise<MarketsResponse> {
  // Simulate ~200 ms Soroban RPC network latency
  await new Promise<void>((resolve) => setTimeout(resolve, 200));

  const markets: AssetMarket[] = assets.map((symbol) => {
    const base = BASE_MARKETS[symbol];
    const jitter = () => (Math.random() - 0.5) * 0.1;
    return {
      asset: symbol,
      supplyApr:   parseFloat((base.supplyApr + jitter()).toFixed(2)),
      borrowApr:   parseFloat((base.borrowApr + jitter()).toFixed(2)),
      utilization: parseFloat(Math.min(1, Math.max(0, base.utilization + (Math.random() - 0.5) * 0.01)).toFixed(4)),
      totalSupply: base.totalSupply,
      totalBorrow: base.totalBorrow,
    };
  });

  return {
    markets,
    timestamp: new Date().toISOString(),
    source: `Soroban RPC stub (${config.stellar.sorobanRpcUrl})`,
  };
}

export { ASSET_SYMBOLS };
