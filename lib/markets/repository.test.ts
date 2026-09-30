import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ASSET_SYMBOLS, type AssetSymbol } from '@/types/enums';
import type { AssetMarket, MarketsResponse } from './types';
import { fetchMarkets } from './repository';

/**
 * `lib/markets/repository.ts` is the data-access layer behind the markets API.
 * It currently ships as a documented stub: `fetchMarkets` simulates ~200 ms of
 * Soroban RPC latency and returns representative per-asset values with small
 * random jitter, pending the real `get_reserve_data` contract call.
 *
 * These tests pin the contract that the API route and its consumers rely on --
 * response shape, per-asset lookup, ordering, and the bounds the jitter must
 * stay inside -- so the eventual swap to a live Soroban call is a drop-in
 * replacement rather than a silent change in behaviour.
 *
 * See `docs/markets-repository.md`.
 */

/** Latency the stub simulates, in ms. */
const SIMULATED_LATENCY_MS = 200;

/**
 * Drives `fetchMarkets` past its simulated latency without waiting in real
 * time. The timer is advanced after the promise is created so the pending
 * `setTimeout` exists by the time it is flushed.
 */
async function resolveWithFakeTimers(
  promise: Promise<MarketsResponse>,
): Promise<MarketsResponse> {
  await vi.advanceTimersByTimeAsync(SIMULATED_LATENCY_MS);
  return promise;
}

describe('lib/markets/repository', () => {
  describe('fetchMarkets — response envelope', () => {
    it('returns markets, timestamp, and source', async () => {
      const result = await fetchMarkets(['XLM']);

      expect(result).toHaveProperty('markets');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('source');
      expect(Object.keys(result).sort()).toEqual(['markets', 'source', 'timestamp']);
    });

    it('labels the source so callers can tell stub data from live data', async () => {
      const result = await fetchMarkets(['XLM']);

      // Consumers surface this verbatim; changing it is a visible contract change.
      expect(result.source).toBe('Soroban RPC stub (server relay)');
    });

    it('stamps an ISO-8601 timestamp', async () => {
      const before = Date.now();
      const result = await fetchMarkets(['XLM']);
      const after = Date.now();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const parsed = Date.parse(result.timestamp);
      expect(Number.isNaN(parsed)).toBe(false);
      expect(parsed).toBeGreaterThanOrEqual(before - 1000);
      expect(parsed).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('fetchMarkets — reading known assets', () => {
    it.each(ASSET_SYMBOLS)('returns a fully-shaped market for %s', async (symbol) => {
      const { markets } = await fetchMarkets([symbol]);

      expect(markets).toHaveLength(1);
      const market = markets[0];

      // Shape must match AssetMarket in ./types.
      expect(Object.keys(market).sort()).toEqual(
        ['asset', 'borrowApr', 'supplyApr', 'totalBorrow', 'totalSupply', 'utilization'].sort(),
      );
      expect(market.asset).toBe(symbol);
      for (const field of ['supplyApr', 'borrowApr', 'utilization', 'totalSupply', 'totalBorrow'] as const) {
        expect(typeof market[field]).toBe('number');
        expect(Number.isFinite(market[field])).toBe(true);
      }
    });

    it('returns every supported asset when asked for all of them', async () => {
      const { markets } = await fetchMarkets([...ASSET_SYMBOLS]);

      expect(markets).toHaveLength(ASSET_SYMBOLS.length);
      expect(markets.map((m) => m.asset)).toEqual([...ASSET_SYMBOLS]);
    });

    it('quotes a borrow APR above the supply APR for every asset', async () => {
      // The spread is what makes the pool solvent; an inversion is a real bug.
      const { markets } = await fetchMarkets([...ASSET_SYMBOLS]);

      for (const market of markets) {
        expect(market.borrowApr).toBeGreaterThan(market.supplyApr);
      }
    });

    it('keeps totalBorrow within totalSupply', async () => {
      const { markets } = await fetchMarkets([...ASSET_SYMBOLS]);

      for (const market of markets) {
        expect(market.totalBorrow).toBeLessThanOrEqual(market.totalSupply);
        expect(market.totalSupply).toBeGreaterThan(0);
        expect(market.totalBorrow).toBeGreaterThanOrEqual(0);
      }
    });

    it('reports utilization as a 0..1 ratio, not a percentage', async () => {
      const { markets } = await fetchMarkets([...ASSET_SYMBOLS]);

      for (const market of markets) {
        expect(market.utilization).toBeGreaterThanOrEqual(0);
        expect(market.utilization).toBeLessThanOrEqual(1);
      }
    });

    it('rounds APRs to 2dp and utilization to 4dp', async () => {
      // The route serialises these straight to JSON; unrounded floats would
      // leak long decimal tails into the API response.
      const { markets } = await fetchMarkets([...ASSET_SYMBOLS]);

      for (const market of markets) {
        expect(market.supplyApr).toBe(parseFloat(market.supplyApr.toFixed(2)));
        expect(market.borrowApr).toBe(parseFloat(market.borrowApr.toFixed(2)));
        expect(market.utilization).toBe(parseFloat(market.utilization.toFixed(4)));
      }
    });
  });

  describe('fetchMarkets — ordering and list stability', () => {
    it('preserves the requested order rather than a canonical one', async () => {
      const requested: AssetSymbol[] = ['ETH', 'XLM', 'BTC', 'USDC'];
      const { markets } = await fetchMarkets(requested);

      expect(markets.map((m) => m.asset)).toEqual(requested);
    });

    it('returns one row per requested entry, preserving duplicates positionally', async () => {
      const { markets } = await fetchMarkets(['XLM', 'XLM', 'USDC']);

      // The stub maps 1:1 over the input; it does not de-duplicate.
      expect(markets).toHaveLength(3);
      expect(markets.map((m) => m.asset)).toEqual(['XLM', 'XLM', 'USDC']);
    });

    it('keeps asset ordering stable across repeated calls', async () => {
      const requested: AssetSymbol[] = ['USDC', 'BTC', 'XLM'];
      const first = await fetchMarkets(requested);
      const second = await fetchMarkets(requested);

      expect(first.markets.map((m) => m.asset)).toEqual(second.markets.map((m) => m.asset));
    });
  });

  describe('fetchMarkets — empty and unknown reads', () => {
    it('returns an empty market list for an empty request', async () => {
      const result = await fetchMarkets([]);

      expect(result.markets).toEqual([]);
      // The envelope is still well-formed so callers need no special case.
      expect(typeof result.timestamp).toBe('string');
      expect(result.source).toBe('Soroban RPC stub (server relay)');
    });

    it('throws on an unknown symbol rather than emitting a malformed market', async () => {
      // BASE_MARKETS has no entry, so the stub dereferences undefined. Failing
      // loudly is the safe behaviour: a NaN APR would otherwise reach the UI.
      // Callers must gate on isAssetSymbol() before reaching the repository.
      await expect(
        fetchMarkets(['DOGE' as AssetSymbol]),
      ).rejects.toThrow(TypeError);
    });

    it('rejects the whole call when one entry in a batch is unknown', async () => {
      await expect(
        fetchMarkets(['XLM', 'NOPE' as AssetSymbol]),
      ).rejects.toThrow(TypeError);
    });
  });

  describe('fetchMarkets — jitter bounds', () => {
    it('stays within ±0.05 of the baseline APR for a known asset', async () => {
      // jitter() is (Math.random() - 0.5) * 0.1, so the excursion is ±0.05
      // before rounding. Baselines: XLM supply 8.5 / borrow 12.0.
      const results = await Promise.all(
        Array.from({ length: 25 }, () => fetchMarkets(['XLM'])),
      );

      for (const { markets } of results) {
        expect(markets[0].supplyApr).toBeGreaterThanOrEqual(8.5 - 0.06);
        expect(markets[0].supplyApr).toBeLessThanOrEqual(8.5 + 0.06);
        expect(markets[0].borrowApr).toBeGreaterThanOrEqual(12.0 - 0.06);
        expect(markets[0].borrowApr).toBeLessThanOrEqual(12.0 + 0.06);
      }
    });

    it('clamps utilization into 0..1 at the extremes of the random range', async () => {
      const randomSpy = vi.spyOn(Math, 'random');

      randomSpy.mockReturnValue(1);
      const high = await fetchMarkets([...ASSET_SYMBOLS]);
      for (const market of high.markets) {
        expect(market.utilization).toBeLessThanOrEqual(1);
      }

      randomSpy.mockReturnValue(0);
      const low = await fetchMarkets([...ASSET_SYMBOLS]);
      for (const market of low.markets) {
        expect(market.utilization).toBeGreaterThanOrEqual(0);
      }

      randomSpy.mockRestore();
    });

    it('leaves totalSupply and totalBorrow un-jittered', async () => {
      // Only the rate fields fluctuate; balances are returned as-is, so the
      // dashboard does not show drifting TVL between polls.
      const first = await fetchMarkets([...ASSET_SYMBOLS]);
      const second = await fetchMarkets([...ASSET_SYMBOLS]);

      expect(first.markets.map((m) => m.totalSupply)).toEqual(
        second.markets.map((m) => m.totalSupply),
      );
      expect(first.markets.map((m) => m.totalBorrow)).toEqual(
        second.markets.map((m) => m.totalBorrow),
      );
    });

    it('does not mutate its baseline between calls', async () => {
      // Regression guard: if the stub ever jittered BASE_MARKETS in place, the
      // values would random-walk away from the baseline over time.
      const runs = await Promise.all(
        Array.from({ length: 10 }, () => fetchMarkets(['USDC'])),
      );

      for (const { markets } of runs) {
        expect(markets[0].supplyApr).toBeGreaterThanOrEqual(5.2 - 0.06);
        expect(markets[0].supplyApr).toBeLessThanOrEqual(5.2 + 0.06);
      }
    });
  });

  describe('fetchMarkets — simulated latency', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it(`resolves only after ~${SIMULATED_LATENCY_MS}ms`, async () => {
      let settled = false;
      const pending = fetchMarkets(['XLM']).then((r) => {
        settled = true;
        return r;
      });

      await vi.advanceTimersByTimeAsync(SIMULATED_LATENCY_MS - 1);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toBe(true);
    });

    it('pays the latency once per call, not once per asset', async () => {
      const result = await resolveWithFakeTimers(fetchMarkets([...ASSET_SYMBOLS]));

      expect(result.markets).toHaveLength(ASSET_SYMBOLS.length);
    });
  });

  describe('re-exports', () => {
    it('re-exports ASSET_SYMBOLS so callers need one import', async () => {
      const mod = await import('./repository');

      expect(mod.ASSET_SYMBOLS).toEqual(ASSET_SYMBOLS);
    });
  });

  describe('type conformance', () => {
    it('satisfies the MarketsResponse / AssetMarket types at runtime', async () => {
      const result: MarketsResponse = await fetchMarkets([...ASSET_SYMBOLS]);
      const market: AssetMarket = result.markets[0];

      expect(Array.isArray(result.markets)).toBe(true);
      expect(ASSET_SYMBOLS).toContain(market.asset);
    });
  });
});
