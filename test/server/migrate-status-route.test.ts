import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const mockReaddir = vi.fn<[], Promise<string[]>>();
vi.mock('fs/promises', () => ({ readdir: mockReaddir }));

const mockQuery = vi.fn<Promise<{ rows: Array<{ name: string }> }>, [string]>();
vi.mock('pg', () => ({
  Client: class {
    async connect() {}
    async query(sql: string) {
      return mockQuery(sql);
    }
    async end() {}
  },
}));

describe('GET /api/admin/migrate-status', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...process.env };
    mockReaddir.mockReset();
    mockQuery.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok=true when no pending migrations', async () => {
    process.env.SERVER_TOKEN = 'test-token';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost/db';
    mockReaddir.mockResolvedValue(['202301_init.sql']);
    mockQuery.mockResolvedValue({ rows: [{ name: '202301_init' }] });

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
    mockQuery.mockResolvedValue({ rows: [{ name: '202301_init' }] });

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
});
