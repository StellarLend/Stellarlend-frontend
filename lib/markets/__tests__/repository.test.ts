import { fetchMarkets, ASSET_SYMBOLS } from '../repository';
import { ASSET_SYMBOLS as ENUM_ASSET_SYMBOLS, type AssetSymbol } from '@/types/enums';

describe('fetchMarkets (stub)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns one AssetMarket per requested asset, in input order', async () => {
    const request = ['XLM', 'USDC', 'BTC'] as AssetSymbol[];
    const promise = fetchMarkets(request);
    jest.advanceTimersByTime(250);
    const result = await promise;
    expect(result.markets).toHaveLength(3);
    expect(result.markets.map((m) => m.asset)).toEqual(request);
  });

  it('returns an empty markets array when called with no assets', async () => {
    const promise = fetchMarkets([]);
    jest.advanceTimersByTime(250);
    const result = await promise;
    expect(result.markets).toEqual([]);
  });

  it('every returned AssetMarket has the AssetSymbol field set', async () => {
    const promise = fetchMarkets(['ETH'] as AssetSymbol[]);
    jest.advanceTimersByTime(250);
    const result = await promise;
    expect(result.markets[0].asset).toBe('ETH');
  });

  it('re-exported ASSET_SYMBOLS matches the canonical enum', () => {
    expect(ASSET_SYMBOLS).toEqual(ENUM_ASSET_SYMBOLS);
  });

  it('every base asset is included in the canonical ASSET_SYMBOLS enum', () => {
    for (const symbol of ['XLM', 'USDC', 'BTC', 'ETH'] as AssetSymbol[]) {
      expect(ENUM_ASSET_SYMBOLS).toContain(symbol);
    }
  });

  it('result includes an ISO timestamp and the source string', async () => {
    const promise = fetchMarkets(['XLM'] as AssetSymbol[]);
    jest.advanceTimersByTime(250);
    const result = await promise;
    expect(result.timestamp).toMatch(/T/);
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    expect(result.source).toBe('Soroban RPC stub (server relay)');
  });

  it('supplyApr and borrowApr are positive numbers (within a small band around the base)', async () => {
    const promise = fetchMarkets(['XLM'] as AssetSymbol[]);
    jest.advanceTimersByTime(250);
    const result = await promise;
    const m = result.markets[0];
    expect(m.supplyApr).toBeGreaterThan(0);
    expect(m.borrowApr).toBeGreaterThan(0);
    // Base: XLM supplyApr=8.5, borrowApr=12.0, jitter ±0.05
    expect(m.supplyApr).toBeGreaterThan(8.0);
    expect(m.supplyApr).toBeLessThan(9.0);
    expect(m.borrowApr).toBeGreaterThan(11.5);
    expect(m.borrowApr).toBeLessThan(12.5);
  });

  it('utilization is clamped to [0, 1]', async () => {
    // Run a few times to exercise the random path.
    for (let i = 0; i < 20; i++) {
      const promise = fetchMarkets(['XLM', 'BTC'] as AssetSymbol[]);
      jest.advanceTimersByTime(250);
      const result = await promise;
      for (const m of result.markets) {
        expect(m.utilization).toBeGreaterThanOrEqual(0);
        expect(m.utilization).toBeLessThanOrEqual(1);
      }
    }
  });

  it('totalSupply and totalBorrow are passed through unchanged from the base table', async () => {
    const promise = fetchMarkets(['USDC'] as AssetSymbol[]);
    jest.advanceTimersByTime(250);
    const result = await promise;
    expect(result.markets[0].totalSupply).toBe(10_000_000);
    expect(result.markets[0].totalBorrow).toBe(6_500_000);
  });

});
