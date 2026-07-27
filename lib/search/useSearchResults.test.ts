import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { flattenSearchResults, getResultByIndex, getResultsCount, toSearchError } from './useSearchResults';
import type { GroupedSearchResults } from './types';

// Mock transaction data
const mockTransaction = {
  id: 'TXN123',
  type: 'transaction' as const,
  title: 'Deposit - XLM',
  subtitle: '1000 XLM • 2025-06-27',
  transaction: {
    id: 'TXN123',
    type: 'Deposit' as const,
    amount: 1000,
    asset: 'XLM' as const,
    date: '2025-06-27',
    time: '10:00AM',
    status: 'Completed' as const,
  },
};

const mockPosition = {
  id: 'pos-xlm-1',
  type: 'position' as const,
  title: 'XLM Position',
  subtitle: 'Balance: $5,000.00',
  asset: 'XLM',
};

describe('Search Utilities', () => {
  describe('flattenSearchResults', () => {
    it('should flatten empty grouped results', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(0);
    });

    it('should flatten transactions only', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(1);
      expect(flattened[0].type).toBe('transaction');
    });

    it('should flatten positions only', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [mockPosition],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(1);
      expect(flattened[0].type).toBe('position');
    });

    it('should flatten mixed transactions and positions', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [mockPosition],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(2);
      expect(flattened[0].type).toBe('transaction');
      expect(flattened[1].type).toBe('position');
    });

    it('should preserve order with multiple results', () => {
      const tx2 = { ...mockTransaction, id: 'TXN124' };
      const pos2 = { ...mockPosition, id: 'pos-usdc-1' };

      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction, tx2],
        positions: [mockPosition, pos2],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(4);
      expect(flattened[0].id).toBe('TXN123');
      expect(flattened[1].id).toBe('TXN124');
      expect(flattened[2].id).toBe('pos-xlm-1');
      expect(flattened[3].id).toBe('pos-usdc-1');
    });
  });

  describe('getResultByIndex', () => {
    it('should return undefined for empty results', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [],
      };

      const result = getResultByIndex(grouped, 0);
      expect(result).toBeUndefined();
    });

    it('should return first result', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [],
      };

      const result = getResultByIndex(grouped, 0);
      expect(result).toBeDefined();
      expect(result?.id).toBe('TXN123');
    });

    it('should return result by index', () => {
      const tx2 = { ...mockTransaction, id: 'TXN124' };
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction, tx2],
        positions: [mockPosition],
      };

      const result0 = getResultByIndex(grouped, 0);
      const result1 = getResultByIndex(grouped, 1);
      const result2 = getResultByIndex(grouped, 2);

      expect(result0?.id).toBe('TXN123');
      expect(result1?.id).toBe('TXN124');
      expect(result2?.id).toBe('pos-xlm-1');
    });

    it('should return undefined for out of bounds index', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [],
      };

      const result = getResultByIndex(grouped, 100);
      expect(result).toBeUndefined();
    });

    it('should return undefined for negative index', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [],
      };

      const result = getResultByIndex(grouped, -1);
      expect(result).toBeUndefined();
    });
  });

  describe('getResultsCount', () => {
    it('should return 0 for empty results', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [],
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(0);
    });

    it('should count only transactions', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
        positions: [],
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(2);
    });

    it('should count only positions', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [mockPosition, { ...mockPosition, id: 'pos-usdc-1' }],
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(2);
    });

    it('should count mixed results', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
        positions: [mockPosition, { ...mockPosition, id: 'pos-usdc-1' }],
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(4);
    });

    it('should count large result sets', () => {
      const grouped: GroupedSearchResults = {
        transactions: Array.from({ length: 50 }, (_, i) => ({
          ...mockTransaction,
          id: `TXN${i}`,
        })),
        positions: Array.from({ length: 30 }, (_, i) => ({
          ...mockPosition,
          id: `pos-${i}`,
        })),
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(80);
    });
  });
});

// ---------------------------------------------------------------------------
// fetchPositions – tests exercising the real /api/positions integration path
// ---------------------------------------------------------------------------

// We test the normalisation logic directly via renderHook.  useSearchResults
// uses a setTimeout for debouncing, so we need fake timers to flush it.

import { renderHook, act } from '@testing-library/react';
import { useSearchResults } from './useSearchResults';

const POSITIONS_ARRAY_RESPONSE = {
  positions: [
    { id: 'pos-xlm-1', asset: 'XLM', availableBalance: '$3,750.00 XLM' },
    { id: 'pos-usdc-1', asset: 'USDC', availableBalance: '$1,200.00 USDC' },
  ],
};

const POSITIONS_FLAT_RESPONSE = {
  asset: 'XLM',
  availableBalance: '$3,750.00 XLM',
};

/** Builds a URL-aware fetch mock so /api/transactions and /api/positions can
 *  return independent responses in the same test. */
function makeRoutedFetch(
  positionsBody: unknown,
  positionsOk = true,
  options: { positionsStatus?: number; transactionsOk?: boolean; transactionsStatus?: number; transactionsBody?: unknown } = {}
) {
  const {
    positionsStatus = positionsOk ? 200 : 401,
    transactionsOk = true,
    transactionsStatus = transactionsOk ? 200 : 500,
    transactionsBody = { transactions: [] },
  } = options;

  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/positions')) {
      return Promise.resolve({
        ok: positionsOk,
        status: positionsStatus,
        statusText: positionsOk ? 'OK' : 'Error',
        json: () => Promise.resolve(positionsBody),
      });
    }
    // /api/transactions
    return Promise.resolve({
      ok: transactionsOk,
      status: transactionsStatus,
      statusText: transactionsOk ? 'OK' : 'Internal Server Error',
      json: () => Promise.resolve(transactionsBody),
    });
  });
}

describe('useSearchResults – fetchPositions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Helper: search + flush debounce setTimeout + await all async microtasks. */
  async function searchAndFlush(result: ReturnType<typeof renderHook<ReturnType<typeof useSearchResults>, unknown>>['result'], query: string) {
    act(() => { result.current.search(query); });
    await act(async () => { vi.runAllTimers(); });
  }

  it('maps an array positions response and filters by query', async () => {
    vi.stubGlobal('fetch', makeRoutedFetch(POSITIONS_ARRAY_RESPONSE));

    const { result } = renderHook(() => useSearchResults(0, 5));
    await searchAndFlush(result, 'XLM');

    expect(result.current.results.state).toBe('success');
    const positions = result.current.results.results.positions;
    expect(positions).toHaveLength(1);
    expect(positions[0].asset).toBe('XLM');
    expect(positions[0].id).toBe('pos-xlm-1');
    expect(positions[0].subtitle).toBe('Balance: $3,750.00 XLM');
  });

  it('maps a flat (single-position) positions response', async () => {
    vi.stubGlobal('fetch', makeRoutedFetch(POSITIONS_FLAT_RESPONSE));

    const { result } = renderHook(() => useSearchResults(0, 5));
    await searchAndFlush(result, 'XLM');

    expect(result.current.results.state).toBe('success');
    const positions = result.current.results.results.positions;
    expect(positions).toHaveLength(1);
    expect(positions[0].asset).toBe('XLM');
    expect(positions[0].subtitle).toBe('Balance: $3,750.00 XLM');
  });

  it('returns empty positions when /api/positions returns an empty array', async () => {
    vi.stubGlobal('fetch', makeRoutedFetch({ positions: [] }));

    const { result } = renderHook(() => useSearchResults(0, 5));
    await searchAndFlush(result, 'XLM');

    expect(result.current.results.state).toBe('success');
    expect(result.current.results.results.positions).toHaveLength(0);
  });

  it('transitions to error state when /api/positions returns a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      makeRoutedFetch({ error: 'Unauthorized' }, false, { positionsStatus: 401 })
    );

    const { result } = renderHook(() => useSearchResults(0, 5));
    await searchAndFlush(result, 'XLM');

    expect(result.current.results.state).toBe('error');
    expect(result.current.results.error?.message).toContain('401');
    expect(result.current.results.error?.retryable).toBe(false);
  });
});

describe('toSearchError', () => {
  it('marks a 500 response as a retryable server error', () => {
    const err = toSearchError(new Error('Failed to load transactions: 500'));
    expect(err.statusCode).toBe(500);
    expect(err.retryable).toBe(true);
    expect(err.message).toBe('Server error while searching. Please try again.');
  });

  it('marks a 503 response as retryable', () => {
    const err = toSearchError(new Error('Failed to fetch positions: 503'));
    expect(err.statusCode).toBe(503);
    expect(err.retryable).toBe(true);
  });

  it('marks a 400 response as non-retryable', () => {
    const err = toSearchError(new Error('Failed to load transactions: 400'));
    expect(err.statusCode).toBe(400);
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('400');
  });
});

describe('useSearchResults – 5xx from search data source', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function searchAndFlush(
    result: ReturnType<typeof renderHook<ReturnType<typeof useSearchResults>, unknown>>['result'],
    query: string
  ) {
    act(() => {
      result.current.search(query);
    });
    await act(async () => {
      vi.runAllTimers();
    });
  }

  it('surfaces a 500 from /api/transactions as a retryable error, not an empty result set', async () => {
    vi.stubGlobal(
      'fetch',
      makeRoutedFetch(POSITIONS_ARRAY_RESPONSE, true, {
        transactionsOk: false,
        transactionsStatus: 500,
      })
    );

    const { result } = renderHook(() => useSearchResults(0, 5));
    await searchAndFlush(result, 'xlm');

    expect(result.current.results.state).toBe('error');
    expect(result.current.results.error).toEqual(
      expect.objectContaining({
        statusCode: 500,
        retryable: true,
        message: 'Server error while searching. Please try again.',
        source: 'all',
      })
    );
    // Must not look like a successful empty search
    expect(result.current.results.state).not.toBe('success');
  });

  it('exposes retry() that re-runs the last query after a 500', async () => {
    vi.stubGlobal(
      'fetch',
      makeRoutedFetch(POSITIONS_ARRAY_RESPONSE, true, {
        transactionsOk: false,
        transactionsStatus: 500,
      })
    );

    const { result } = renderHook(() => useSearchResults(0, 5));
    await searchAndFlush(result, 'deposit');

    expect(result.current.results.state).toBe('error');
    expect(result.current.results.error?.retryable).toBe(true);

    // Recover on retry
    vi.stubGlobal(
      'fetch',
      makeRoutedFetch(POSITIONS_ARRAY_RESPONSE, true, {
        transactionsOk: true,
        transactionsStatus: 200,
      })
    );

    act(() => {
      result.current.retry();
    });
    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.results.state).toBe('success');
    expect(result.current.results.error).toBeNull();
  });

  it('treats a successful empty result set differently from a 500 error', async () => {
    vi.stubGlobal(
      'fetch',
      makeRoutedFetch({ positions: [] }, true, {
        transactionsOk: true,
        transactionsBody: { transactions: [] },
      })
    );

    const { result } = renderHook(() => useSearchResults(0, 5));
    await searchAndFlush(result, 'zzzz-no-match');

    expect(result.current.results.state).toBe('success');
    expect(result.current.results.total).toBe(0);
    expect(result.current.results.error).toBeNull();
  });
});
