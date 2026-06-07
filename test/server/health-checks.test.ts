import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/pool', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('@/lib/metrics/registry', () => ({
  updateDbPoolMetrics: vi.fn(),
}));

const { checkDatabase } = await import('@/lib/health/checks');
const { pool } = await import('@/lib/db/pool');
const { updateDbPoolMetrics } = await import('@/lib/metrics/registry');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkDatabase', () => {
  it('returns healthy when the database query succeeds', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [{ '?:column?': 1 }] });

    const status = await checkDatabase();

    expect(status).toBe('healthy');
    expect(updateDbPoolMetrics).toHaveBeenCalledWith(pool);
  });

  it('returns degraded when the database query times out', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection timed out'));

    const status = await checkDatabase();

    expect(status).toBe('degraded');
    expect(updateDbPoolMetrics).toHaveBeenCalledWith(pool);
  });

  it('returns unhealthy for generic database failures', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('syntax error'));

    const status = await checkDatabase();

    expect(status).toBe('unhealthy');
    expect(updateDbPoolMetrics).toHaveBeenCalledWith(pool);
  });
});
