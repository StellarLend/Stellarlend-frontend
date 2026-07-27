import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAccountOperations, HorizonError } from '../horizon';
import { normalizeOperation, normalizeOperations } from '../normalizer';
import { IndexerCache } from '../cache';
import { indexAccountTransactions, invalidateAccountCache } from '../index';
import type { HorizonOperation, HorizonPage } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCOUNT = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890ABCDEFGH';
const OTHER   = 'GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890ABCDEFGH';

function makeOp(overrides: Partial<HorizonOperation> = {}): HorizonOperation {
  return {
    id: 'op-001',
    type: 'payment',
    created_at: '2024-03-15T14:30:00Z',
    transaction_successful: true,
    from: OTHER,
    to: ACCOUNT,
    amount: '100.0000000',
    asset_type: 'native',
    ...overrides,
  };
}

function makeHorizonPage(records: HorizonOperation[], nextHref?: string): HorizonPage {
  return {
    _embedded: { records },
    _links: {
      self: { href: 'https://horizon-testnet.stellar.org/accounts/GA.../operations' },
      ...(nextHref ? { next: { href: nextHref } } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// normalizeOperation
// ---------------------------------------------------------------------------

describe('normalizeOperation', () => {
  it('maps an incoming payment to a Deposit with positive amount', () => {
    const op = makeOp({ to: ACCOUNT, from: OTHER, amount: '250.5', asset_type: 'native' });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('Deposit');
    expect(tx!.amount).toBeCloseTo(250.5);
    expect(tx!.asset).toBe('XLM');
    expect(tx!.status).toBe('Completed');
  });

  it('maps an outgoing payment to a Withdrawal with negative amount', () => {
    const op = makeOp({ from: ACCOUNT, to: OTHER, amount: '50.0', asset_type: 'native' });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('Withdrawal');
    expect(tx!.amount).toBeCloseTo(-50.0);
  });

  it('maps a payment in a supported non-native asset', () => {
    const op = makeOp({
      to: ACCOUNT,
      from: OTHER,
      amount: '10.0',
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GABCISSUER',
    });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.asset).toBe('USDC');
  });

  it('returns null for an unsupported asset code', () => {
    const op = makeOp({
      to: ACCOUNT,
      asset_type: 'credit_alphanum4',
      asset_code: 'AQUA',
    });
    expect(normalizeOperation(op, ACCOUNT)).toBeNull();
  });

  it('maps a failed payment to status Failed', () => {
    const op = makeOp({ transaction_successful: false });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.status).toBe('Failed');
  });

  it('returns null for a payment with zero amount', () => {
    const op = makeOp({ amount: '0.0000000' });
    expect(normalizeOperation(op, ACCOUNT)).toBeNull();
  });

  it('maps create_account (incoming) to a Deposit in XLM', () => {
    const op = makeOp({
      type: 'create_account',
      account: ACCOUNT,
      funder: OTHER,
      starting_balance: '1000.0',
      amount: undefined,
      from: undefined,
      to: undefined,
    });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('Deposit');
    expect(tx!.asset).toBe('XLM');
    expect(tx!.amount).toBeCloseTo(1000.0);
  });

  it('maps create_account (outgoing funder) to a Withdrawal in XLM', () => {
    const op = makeOp({
      type: 'create_account',
      account: OTHER,
      funder: ACCOUNT,
      starting_balance: '500.0',
      amount: undefined,
      from: undefined,
      to: undefined,
    });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('Withdrawal');
    expect(tx!.amount).toBeCloseTo(-500.0);
  });

  it('maps incoming path_payment_strict_send to a Deposit', () => {
    const op = makeOp({
      type: 'path_payment_strict_send',
      to: ACCOUNT,
      from: OTHER,
      asset_type: 'native',
      destination_amount: '75.0',
    });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('Deposit');
    expect(tx!.amount).toBeCloseTo(75.0);
  });

  it('maps outgoing path_payment_strict_receive to a Withdrawal', () => {
    const op = makeOp({
      type: 'path_payment_strict_receive',
      from: ACCOUNT,
      to: OTHER,
      source_asset_type: 'native',
      source_amount: '30.0',
    });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('Withdrawal');
    expect(tx!.amount).toBeCloseTo(-30.0);
  });

  it('returns null for unhandled operation types like change_trust', () => {
    const op = makeOp({ type: 'change_trust' });
    expect(normalizeOperation(op, ACCOUNT)).toBeNull();
  });

  it('returns null for manage_sell_offer', () => {
    const op = makeOp({ type: 'manage_sell_offer' });
    expect(normalizeOperation(op, ACCOUNT)).toBeNull();
  });

  it('formats date and time correctly from ISO timestamp', () => {
    const op = makeOp({ created_at: '2024-03-15T14:30:00Z' });
    const tx = normalizeOperation(op, ACCOUNT);

    expect(tx).not.toBeNull();
    expect(tx!.date).toBe('2024-03-15');
    expect(tx!.time).toBe('02:30PM');
  });

  it('preserves the Horizon operation id as the transaction id', () => {
    const op = makeOp({ id: 'horizon-op-99999' });
    const tx = normalizeOperation(op, ACCOUNT);
    expect(tx!.id).toBe('horizon-op-99999');
  });
});

// ---------------------------------------------------------------------------
// normalizeOperations
// ---------------------------------------------------------------------------

describe('normalizeOperations', () => {
  it('filters out null results and returns only mappable operations', () => {
    const ops: HorizonOperation[] = [
      makeOp({ id: 'op-1', to: ACCOUNT, amount: '100.0' }),
      makeOp({ id: 'op-2', type: 'change_trust' }),
      makeOp({ id: 'op-3', to: ACCOUNT, amount: '200.0' }),
    ];
    const txs = normalizeOperations(ops, ACCOUNT);
    expect(txs).toHaveLength(2);
    expect(txs.map((t) => t.id)).toEqual(['op-1', 'op-3']);
  });

  it('returns an empty array when no operations are mappable', () => {
    const ops = [makeOp({ type: 'set_options' }), makeOp({ type: 'manage_data' })];
    expect(normalizeOperations(ops, ACCOUNT)).toHaveLength(0);
  });

  it('returns an empty array for an empty input', () => {
    expect(normalizeOperations([], ACCOUNT)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// IndexerCache
// ---------------------------------------------------------------------------

describe('IndexerCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a missing key', () => {
    const c = new IndexerCache<string>();
    expect(c.get('missing')).toBeNull();
  });

  it('returns the stored value before TTL expires', () => {
    const c = new IndexerCache<string>();
    c.set('k', 'hello', 5_000);
    expect(c.get('k')).toBe('hello');
  });

  it('returns null after TTL expires', () => {
    const c = new IndexerCache<string>();
    c.set('k', 'hello', 5_000);
    vi.advanceTimersByTime(5_001);
    expect(c.get('k')).toBeNull();
  });

  it('invalidate removes the entry immediately', () => {
    const c = new IndexerCache<string>();
    c.set('k', 'value', 60_000);
    c.invalidate('k');
    expect(c.get('k')).toBeNull();
  });

  it('clear removes all entries', () => {
    const c = new IndexerCache<number>();
    c.set('a', 1);
    c.set('b', 2);
    c.clear();
    expect(c.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fetchAccountOperations (mocked fetch)
// ---------------------------------------------------------------------------

describe('fetchAccountOperations', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns operations from a single-page response', async () => {
    const ops = [makeOp({ id: 'op-1' }), makeOp({ id: 'op-2' })];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeHorizonPage(ops),
    } as Response);

    const result = await fetchAccountOperations(ACCOUNT, { limit: 200 });
    expect(result).toHaveLength(2);
  });

  it('paginates through multiple pages until a partial page is returned', async () => {
    const page1Ops = Array.from({ length: 2 }, (_, i) => makeOp({ id: `op-${i}` }));
    const page2Ops = [makeOp({ id: 'op-last' })];

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          makeHorizonPage(page1Ops, 'https://horizon-testnet.stellar.org/next'),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeHorizonPage(page2Ops),
      } as Response);

    const result = await fetchAccountOperations(ACCOUNT, { limit: 2 });
    expect(result).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws HorizonError on a 404 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    await expect(fetchAccountOperations(ACCOUNT)).rejects.toThrow(HorizonError);
  });

  it('throws HorizonError on a 503 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response);

    await expect(fetchAccountOperations(ACCOUNT)).rejects.toThrow(HorizonError);
  });

  it('throws HorizonError when fetch rejects (network failure)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'));
    await expect(fetchAccountOperations(ACCOUNT)).rejects.toThrow(HorizonError);
  });

  it('throws HorizonError on an abort (timeout)', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    await expect(fetchAccountOperations(ACCOUNT, { timeoutMs: 100 })).rejects.toThrow(
      HorizonError,
    );
  });
});

// ---------------------------------------------------------------------------
// indexAccountTransactions (end-to-end with mocked fetch)
// ---------------------------------------------------------------------------

describe('indexAccountTransactions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    invalidateAccountCache(ACCOUNT);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns normalized transactions from Horizon operations', async () => {
    const ops = [
      makeOp({ id: 'op-1', to: ACCOUNT, amount: '100.0', asset_type: 'native' }),
      makeOp({ id: 'op-2', type: 'change_trust' }), // should be filtered
    ];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeHorizonPage(ops),
    } as Response);

    const txs = await indexAccountTransactions(ACCOUNT, { bypassCache: true });

    expect(txs).toHaveLength(1);
    expect(txs[0].id).toBe('op-1');
    expect(txs[0].type).toBe('Deposit');
  });

  it('returns cached result on second call without hitting fetch again', async () => {
    const ops = [makeOp({ id: 'op-1', to: ACCOUNT, amount: '50.0' })];
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => makeHorizonPage(ops),
    } as Response);

    await indexAccountTransactions(ACCOUNT, { bypassCache: true });
    await indexAccountTransactions(ACCOUNT);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache when bypassCache is true', async () => {
    const ops = [makeOp({ id: 'op-1', to: ACCOUNT, amount: '50.0' })];
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => makeHorizonPage(ops),
    } as Response);

    await indexAccountTransactions(ACCOUNT, { bypassCache: true });
    await indexAccountTransactions(ACCOUNT, { bypassCache: true });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('propagates HorizonError so callers can apply their own fallback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(
      indexAccountTransactions(ACCOUNT, { bypassCache: true }),
    ).rejects.toThrow(HorizonError);
  });
});
