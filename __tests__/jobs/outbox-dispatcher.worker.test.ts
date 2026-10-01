import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));

const mockAdd = vi.fn().mockResolvedValue({});

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockAdd })),
  Worker: vi.fn(),
}));

const mockWhere = vi.fn();
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
vi.mock('@/lib/db/client', () => ({ db: { update: mockUpdate } }));

const mockLoggerError = vi.fn();
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: mockLoggerError } }));

vi.mock('@/lib/notifications/repository', () => ({ addNotification: vi.fn() }));
vi.mock('@/lib/validation/outbox', () => ({
  parseOutboxPayload: vi.fn(),
  OutboxPayloadValidationError: class extends Error {},
  NotificationOutboxPayloadSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
  AuditOutboxPayloadSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
}));

const baseEvent = {
  id: 'evt-1',
  type: 'notification',
  payload: JSON.stringify({ userId: 'u1', title: 'hi', message: 'msg', type: 'info' }),
  status: 'PENDING',
  attempts: 0,
  processedAt: null,
  lastError: null,
  claimedAt: null,
};

describe('dispatchEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enqueues the event and marks it COMPLETED on success', async () => {
    const { dispatchEvent } = await import('../../src/jobs/outbox-dispatcher.worker');
    await dispatchEvent(baseEvent as any);

    expect(mockAdd).toHaveBeenCalledWith('send_notification', expect.any(Object), {
      jobId: 'evt-1',
    });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
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
      expect.any(String),
      expect.objectContaining({ eventId: 'evt-1', error: 'redis down' })
    );
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', lastError: 'redis down' })
    );
  });

  it('handles non-Error throws and still records a string message', async () => {
    mockAdd.mockRejectedValueOnce('plain string error');

    const { dispatchEvent } = await import('../../src/jobs/outbox-dispatcher.worker');
    await dispatchEvent(baseEvent as any);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: 'plain string error' })
    );
  });
});
