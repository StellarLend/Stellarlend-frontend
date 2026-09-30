import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));

const mockAdd = vi.fn().mockResolvedValue({});

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockAdd })),
  Worker: vi.fn(),
}));

const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });
vi.mock('@/lib/db/client', () => ({ db: { update: mockUpdate } }));

const mockLoggerError = vi.fn();
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: mockLoggerError } }));

vi.mock('@/lib/notifications/repository', () => ({ addNotification: vi.fn() }));

const baseEvent = {
  id: 'evt-1',
  type: 'notification' as const,
  payload: JSON.stringify({ userId: 'u1', title: 'hi', message: 'msg', type: 'info' }),
  status: 'PENDING',
  attempts: 0,
  processedAt: null,
  lastError: null,
};

describe('dispatchEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues the event and marks it COMPLETED on success', async () => {
    const { dispatchEvent } = await import('../../src/jobs/outbox-dispatcher.worker');
    await dispatchEvent(baseEvent as any);

    expect(mockAdd).toHaveBeenCalledWith('send_notification', expect.any(Object), {
      jobId: 'evt-1',
    });

    const setArg = mockUpdate.mock.results[0].value.set.mock.calls[0][0];
    expect(setArg.status).toBe('COMPLETED');
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('uses the event id as jobId for idempotency', async () => {
    const { dispatchEvent } = await import('../../src/jobs/outbox-dispatcher.worker');
    await dispatchEvent({ ...baseEvent, id: 'idempotent-id-123' } as any);

    expect(mockAdd).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      { jobId: 'idempotent-id-123' }
    );
  });

  it('marks event FAILED and calls logger.error when dispatch throws', async () => {
    mockAdd.mockRejectedValueOnce(new Error('redis down'));

    const { dispatchEvent } = await import('../../src/jobs/outbox-dispatcher.worker');
    await dispatchEvent(baseEvent as any);

    expect(mockLoggerError).toHaveBeenCalledWith(
      'Failed to dispatch outbox event',
      'jobs/outbox-dispatcher',
      expect.objectContaining({ eventId: 'evt-1', error: 'redis down' })
    );

    const setArg = mockUpdate.mock.results[0].value.set.mock.calls[0][0];
    expect(setArg.status).toBe('FAILED');
    expect(setArg.attempts).toBe(1);
    expect(setArg.lastError).toBe('redis down');
  });

  it('handles non-Error throws and still records a message', async () => {
    mockAdd.mockRejectedValueOnce('string error');

    const { dispatchEvent } = await import('../../src/jobs/outbox-dispatcher.worker');
    await dispatchEvent(baseEvent as any);

    const setArg = mockUpdate.mock.results[0].value.set.mock.calls[0][0];
    expect(setArg.lastError).toBe('string error');
  });
});
