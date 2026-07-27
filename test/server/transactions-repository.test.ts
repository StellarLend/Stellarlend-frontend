import { describe, it, expect, vi } from 'vitest';
import { fetchTransactions } from '@/lib/transactions/repository';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => []),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => ({})),
        })),
      })),
    },
  };
});

describe('fetchTransactions', () => {
  it('returns all transactions when no filter is applied', async () => {
    const txs = await fetchTransactions();
    expect(txs.length).toBeGreaterThan(0);
  });

  it('filters by userId', async () => {
    const txs = await fetchTransactions({ userId: 'user-1' });
    expect(txs.every((t) => t.userId === 'user-1')).toBe(true);
  });

  it('filters by type', async () => {
    const txs = await fetchTransactions({ type: 'lend' });
    expect(txs.every((t) => t.type === 'lend')).toBe(true);
  });

  it('filters by status', async () => {
    const txs = await fetchTransactions({ status: 'completed' });
    expect(txs.every((t) => t.status === 'completed')).toBe(true);
  });

  it('returns empty array when no match', async () => {
    const txs = await fetchTransactions({ userId: 'nonexistent-user' });
    expect(txs).toHaveLength(0);
  });

  it('combines multiple filters', async () => {
    const txs = await fetchTransactions({ userId: 'user-1', type: 'lend' });
    expect(txs.every((t) => t.userId === 'user-1' && t.type === 'lend')).toBe(true);
  });
});
