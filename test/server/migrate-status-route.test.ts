import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const mockReaddir = vi.fn<[], Promise<string[]>>();
vi.mock('fs/promises', () => ({ readdir: mockReaddir }));

const mockPoolQuery = vi.fn<Promise<{ rows: Array<{ name: string }> }>, [string]>();
let pgClientConstructed = false;

vi.mock('@/lib/db/pool', () => ({
  default: {
    query: (sql: string) => mockPoolQuery(sql),
  },
}));

vi.mock('pg', () => ({
  Client: class {
    constructor() {
      pgClientConstructed = true;
    }
    async connect() {}
    async query(sql: string) {
      return mockPoolQuery(sql);
    }
    async end() {}
  },
}));

describe('GET /api/admin/migrate-status', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...process.env };
    pgClientConstructed = false;
    mockReaddir.mockReset();
    mockPoolQuery.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok=true when no pending migrations', async () => {
    process.env.SERVER_TOKEN = 'test-token';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost/db';
    mockReaddir.mockResolvedValue(['202301_init.sql']);
    mockPoolQuery.mockResolvedValue({ rows: [{ name: '202301_init' }] });

    const { GET } = await import('@/app/api/admin/migrate-status/route');
    const res = await GET(
      new NextRequest('http://localhost/api/admin/migrate-status', {
        method: 'GET',
        headers: { 'x-server-token': 'test-token' },
      }) as any
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ applied: ['202301_init'], pending: [], ok: true });
  });

  it('reports pending migrations when source contains newer files', async () => {
    process.env.SERVER_TOKEN = 'test-token-2';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost/db';
    mockReaddir.mockResolvedValue(['202301_init.sql', '202302_new.sql']);
    mockPoolQuery.mockResolvedValue({ rows: [{ name: '202301_init' }] });

    const { GET } = await import('@/app/api/admin/migrate-status/route');
    const res = await GET(
      new NextRequest('http://localhost/api/admin/migrate-status', {
        method: 'GET',
        headers: { 'x-server-token': 'test-token-2' },
      }) as any
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.pending).toEqual(['202302_new']);
  });

  it('rejects non-admin callers', async () => {
    process.env.SERVER_TOKEN = 'real-token';

    const { GET } = await import('@/app/api/admin/migrate-status/route');
    const res = await GET(
      new NextRequest('http://localhost/api/admin/migrate-status', {
        method: 'GET',
        headers: { 'x-server-token': 'wrong' },
      }) as any
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toEqual({ message: 'Unauthorized' });
  });

  it('reuses the connection pool without opening a new raw pg.Client per request', async () => {
    process.env.SERVER_TOKEN = 'test-token';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost/db';
    mockReaddir.mockResolvedValue(['202301_init.sql']);
    mockPoolQuery.mockResolvedValue({ rows: [{ name: '202301_init' }] });

    const { GET } = await import('@/app/api/admin/migrate-status/route');

    // Make multiple requests to the endpoint
    for (let i = 0; i < 3; i++) {
      const res = await GET(
        new NextRequest('http://localhost/api/admin/migrate-status', {
          method: 'GET',
          headers: { 'x-server-token': 'test-token' },
        }) as any
      );
      expect(res.status).toBe(200);
    }

    // Assert the pooled query was used for each request
    expect(mockPoolQuery).toHaveBeenCalledTimes(3);
    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT name FROM __drizzle_migrations ORDER BY id');

    // Assert no raw pg.Client was constructed
    expect(pgClientConstructed).toBe(false);
  });
});
