import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn().mockResolvedValue({ name: 'Test User' }),
}));

vi.mock('@/lib/transactions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/transactions')>('@/lib/transactions');
  return {
    ...actual,
    fetchTransactions: vi.fn().mockResolvedValue([
      { id: 'TXN001', type: 'Deposit',    amount: 1000,  asset: 'XLM',  date: '2025-04-01', time: '10:00AM', status: 'Completed'  },
      { id: 'TXN002', type: 'Withdrawal', amount: -500,  asset: 'BTC',  date: '2025-03-15', time: '11:00AM', status: 'Processing' },
      { id: 'TXN003', type: '=INJECT',    amount: 200,   asset: 'STRK', date: '2025-02-10', time: '09:00AM', status: 'Failed'     },
    ]),
  };
});

function makeRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/transactions/export');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe('GET /api/transactions/export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with text/csv content type', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
  });

  it('sets Content-Disposition attachment header', async () => {
    const res = await GET(makeRequest());
    const disposition = res.headers.get('Content-Disposition');
    expect(disposition).toMatch(/attachment;\s*filename="transactions-\d{4}-\d{2}-\d{2}\.csv"/);
  });

  it('includes CSV header row', async () => {
    const res = await GET(makeRequest());
    const body = await res.text();
    expect(body).toContain('"ID","Type","Amount","Asset","Date","Time","Status"');
  });

  it('returns all transactions when no filters applied', async () => {
    const res = await GET(makeRequest());
    const body = await res.text();
    const lines = body.split('\r\n');
    expect(lines).toHaveLength(4); // 1 header + 3 rows
  });

  it('filters by status query param', async () => {
    const res = await GET(makeRequest({ status: 'Completed' }));
    const body = await res.text();
    const lines = body.split('\r\n');
    expect(lines).toHaveLength(2); // 1 header + 1 completed row
    expect(lines[1]).toContain('TXN001');
  });

  it('filters by search query param', async () => {
    const res = await GET(makeRequest({ search: 'BTC' }));
    const body = await res.text();
    expect(body).toContain('TXN002');
    expect(body).not.toContain('TXN001');
  });

  it('filters by dateFrom query param', async () => {
    const res = await GET(makeRequest({ dateFrom: '2025-04-01' }));
    const body = await res.text();
    const lines = body.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('TXN001');
  });

  it('filters by dateTo query param', async () => {
    const res = await GET(makeRequest({ dateTo: '2025-02-28' }));
    const body = await res.text();
    const lines = body.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('TXN003');
  });

  it('escapes CSV injection in transaction type field', async () => {
    const res = await GET(makeRequest());
    const body = await res.text();
    // =INJECT should be prefixed with a single-quote inside the double-quotes
    expect(body).toContain(`"'=INJECT"`);
    expect(body).not.toContain('"=INJECT"');
  });

  it('sets Cache-Control: no-store', async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 401 when user is not authenticated', async () => {
    const { getUser } = await import('@/lib/auth');
    vi.mocked(getUser).mockResolvedValueOnce(null as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('ignores unknown status values and returns all transactions', async () => {
    const res = await GET(makeRequest({ status: 'INVALID_STATUS' }));
    const body = await res.text();
    const lines = body.split('\r\n');
    expect(lines).toHaveLength(4);
  });
});
