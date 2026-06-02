// __tests__/jobs/retention.worker.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getDeletionCounts } from '../../lib/metrics';

// Mock bullmq to avoid connecting to a real Redis instance during tests
vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      getRepeatableJobs: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue({}),
    })),
    QueueScheduler: vi.fn(),
    Worker: vi.fn(),
  };
});

// Mock the db pool
const mockQuery = vi.fn();
const mockRelease = vi.fn();
vi.mock('../../lib/db/pool', () => {
  return {
    default: {
      connect: vi.fn().mockResolvedValue({
        query: mockQuery,
        release: mockRelease,
      }),
    },
  };
});

describe('Retention Worker', () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockRelease.mockClear();
  });

  it('dry run does not delete rows but logs/counts potential deletions', async () => {
    process.env.RETENTION_DRY_RUN = 'true';

    // Mock count query for each of the three tables: audit_events, sessions, position_snapshots
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 }) // count for audit_events
      .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }) // count for sessions
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }); // count for position_snapshots

    const { runRetention } = await import('../../src/jobs/retention.worker');
    await runRetention();

    // Since it's a dry run, there should be no DELETE queries, only SELECT COUNT(*)
    expect(mockQuery).toHaveBeenCalledTimes(3);
    mockQuery.mock.calls.forEach((call) => {
      expect(call[0]).toContain('SELECT COUNT(*)');
    });

    const counts = getDeletionCounts();
    expect(counts['audit_events']).toBe(5);
    expect(counts['sessions']).toBe(2);
  });

  it('actual run deletes rows in batches', async () => {
    process.env.RETENTION_DRY_RUN = 'false';

    // Set up mock queries:
    // 1. audit_events:
    //    - count: 1500
    //    - delete batch 1: rowCount = 1000
    //    - delete batch 2: rowCount = 500
    // 2. sessions:
    //    - count: 0
    // 3. position_snapshots:
    //    - count: 800
    //    - delete batch 1: rowCount = 800
    mockQuery
      // audit_events
      .mockResolvedValueOnce({ rows: [{ count: '1500' }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1000 })
      .mockResolvedValueOnce({ rowCount: 500 })
      // sessions
      .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
      // position_snapshots
      .mockResolvedValueOnce({ rows: [{ count: '800' }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 800 });

    const { runRetention } = await import('../../src/jobs/retention.worker');
    await runRetention();

    // Verify correct queries were run
    expect(mockQuery).toHaveBeenCalledTimes(6);
    expect(mockQuery.mock.calls[0][0]).toContain('SELECT COUNT(*) FROM audit_events');
    expect(mockQuery.mock.calls[1][0]).toContain('DELETE FROM audit_events');
    expect(mockQuery.mock.calls[2][0]).toContain('DELETE FROM audit_events');
    expect(mockQuery.mock.calls[3][0]).toContain('SELECT COUNT(*) FROM sessions');
    expect(mockQuery.mock.calls[4][0]).toContain('SELECT COUNT(*) FROM position_snapshots');
    expect(mockQuery.mock.calls[5][0]).toContain('DELETE FROM position_snapshots');
  });
});
