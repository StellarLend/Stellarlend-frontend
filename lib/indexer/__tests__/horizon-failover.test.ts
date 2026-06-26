import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HorizonOperation } from '../types';

vi.mock('@/lib/server-config', () => ({
  default: {
    oracle: { apiKey: '' },
    auth: { signingSecret: '' },
    server: { token: '' },
    horizon: {
      urls: ['https://primary.example.com', 'https://secondary.example.com'],
      primaryUrl: 'https://primary.example.com',
    },
  },
}));

let fetchAccountOperations: typeof import('../horizon').fetchAccountOperations;
let HorizonError: typeof import('../horizon').HorizonError;

beforeAll(async () => {
  const horizonModule = await import('../horizon');
  fetchAccountOperations = horizonModule.fetchAccountOperations;
  HorizonError = horizonModule.HorizonError;
});

const ACCOUNT = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890ABCDEFGH';

function makeOp(overrides: Partial<HorizonOperation> = {}): HorizonOperation {
  return {
    id: 'op-001',
    type: 'payment',
    created_at: '2024-03-15T14:30:00Z',
    transaction_successful: true,
    from: 'GXYZ',
    to: ACCOUNT,
    amount: '100.0000000',
    asset_type: 'native',
    ...overrides,
  };
}

function makeHorizonPage(records: HorizonOperation[], nextHref?: string) {
  return {
    _embedded: { records },
    _links: {
      self: { href: `https://primary.example.com/accounts/${ACCOUNT}/operations` },
      ...(nextHref ? { next: { href: nextHref } } : {}),
    },
  };
}

describe('Horizon failover', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails over to the secondary endpoint when the primary returns 503', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => makeHorizonPage([makeOp({ id: 'op-1' })]) } as Response);

    const result = await fetchAccountOperations(ACCOUNT, { limit: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('op-1');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws HorizonError when all configured endpoints are unavailable', async () => {
    vi.mocked(fetch)
      .mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' } as Response);

    await expect(fetchAccountOperations(ACCOUNT, { limit: 1 })).rejects.toThrow(HorizonError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
