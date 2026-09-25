import { beforeEach, describe, expect, it, vi } from 'vitest';

const addNotificationMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/lib/notifications/repository', () => ({
  addNotificationWithOutcome: addNotificationMock,
}));

vi.mock('@/lib/server-config', () => ({
  default: {
    redisUrl: 'redis://localhost:6379',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
}));

vi.mock('@/lib/queue', () => ({
  queueNames: {
    notifications: 'notifications-queue',
  },
  notificationsDeadLetterQueue: {
    add: vi.fn().mockResolvedValue(undefined),
  },
  registerQueueShutdownHooks: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    quit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation((_name: string, handler: unknown) => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    handler,
  })),
}));

describe('src/jobs/notifications.worker', () => {
  beforeEach(() => {
    vi.resetModules();
    addNotificationMock.mockReset();
    loggerInfoMock.mockReset();
    loggerWarnMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it('delivers notifications successfully', async () => {
    const payload = {
      userId: 'user-1',
      title: 'Welcome',
      message: 'Your account is ready.',
      type: 'success' as const,
      id: 'notif-1',
    };

    addNotificationMock.mockResolvedValue({
        notification: {
      id: payload.id,
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      read: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
        inserted: true,
      });

    const { handleNotificationJob } = await import('./notifications.worker');
    const result = await handleNotificationJob(payload, { maxAttempts: 1, backoffMs: 0 });

    expect(result.delivered).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(addNotificationMock).toHaveBeenCalledWith(
      payload.userId,
      expect.objectContaining({
        id: payload.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
      }),
    );
  });

  it('retries transient failures before succeeding', async () => {
    const payload = {
      userId: 'user-2',
      title: 'Reminder',
      message: 'Your next payment is due.',
      type: 'warning' as const,
      id: 'notif-2',
    };

    addNotificationMock
      .mockRejectedValueOnce(new Error('temporary delivery failure'))
      .mockResolvedValueOnce({
          notification: {
        id: payload.id,
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        read: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
          inserted: true,
        });

    const { handleNotificationJob } = await import('./notifications.worker');
    const result = await handleNotificationJob(payload, { maxAttempts: 2, backoffMs: 0 });

    expect(result.delivered).toBe(true);
    expect(addNotificationMock).toHaveBeenCalledTimes(2);
    expect(loggerWarnMock).toHaveBeenCalled();
  });

  it('de-duplicates already-sent notifications', async () => {
    const payload = {
      userId: 'user-3',
      title: 'Digest',
      message: 'Your summary is ready.',
      type: 'info' as const,
      id: 'notif-3',
    };

    addNotificationMock.mockResolvedValue({
      notification: {
        id: payload.id,
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        read: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      inserted: false,
    });

    const { handleNotificationJob } = await import('./notifications.worker');
    const result = await handleNotificationJob(payload, { maxAttempts: 1, backoffMs: 0 });

    expect(result.delivered).toBe(false);
    expect(result.duplicate).toBe(true);
    expect(result.outcome).toBe('duplicate');
    expect(addNotificationMock).toHaveBeenCalledTimes(1);
  });

  describe('input validation and adversarial scenarios', () => {
    it('rejects payload with empty userId', async () => {
      const payload = {
        userId: '',
        title: 'Welcome',
        message: 'Test message',
        type: 'info' as const,
      };

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('rejects payload with empty title', async () => {
      const payload = {
        userId: 'user-1',
        title: '',
        message: 'Test message',
        type: 'info' as const,
      };

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('rejects payload with invalid notification type', async () => {
      const payload = {
        userId: 'user-1',
        title: 'Welcome',
        message: 'Test message',
        type: 'invalid_type' as any,
      };

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('rejects payload with path traversal in notification ID', async () => {
      const payload = {
        userId: 'user-1',
        title: 'Welcome',
        message: 'Test message',
        type: 'info' as const,
        id: '../../etc/passwd',
      };

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('rejects payload with excessively long title (potential DoS)', async () => {
      const payload = {
        userId: 'user-1',
        title: 'a'.repeat(201),
        message: 'Test message',
        type: 'info' as const,
      };

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('rejects payload with excessively long message (potential DoS)', async () => {
      const payload = {
        userId: 'user-1',
        title: 'Welcome',
        message: 'a'.repeat(2001),
        type: 'info' as const,
      };

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('rejects payload with non-string userId (type confusion)', async () => {
      const payload = {
        userId: 123,
        title: 'Welcome',
        message: 'Test message',
        type: 'info' as const,
      };

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('trims whitespace from userId and title before processing', async () => {
      const payload = {
        userId: '  user-1  ',
        title: '  Welcome  ',
        message: 'Test message',
        type: 'info' as const,
        id: 'notif-1',
      };

      addNotificationMock.mockResolvedValue({
        notification: {
        id: 'notif-1',
        userId: 'user-1',
        title: '  Welcome  ',
        message: 'Test message',
        type: 'info',
        read: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
        inserted: true,
      });

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(true);
      expect(addNotificationMock).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          id: 'notif-1',
        }),
      );
    });

    it('handles SQL injection attempt in notification ID gracefully', async () => {
      const payload = {
        userId: 'user-1',
        title: 'Welcome',
        message: 'Test message',
        type: 'info' as const,
        id: "'; DROP TABLE notifications;--",
      };

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload as any, { maxAttempts: 1, backoffMs: 0 });

      expect(result.delivered).toBe(false);
      expect(result.validationError).toBeDefined();
      expect(addNotificationMock).not.toHaveBeenCalled();
    });
  });
  describe('delivery state machine and convergence invariants', () => {
    const payload = {
      userId: 'user-77',
      title: 'Liquidation warning',
      message: 'Your position approaches the liquidation threshold.',
      type: 'warning' as const,
      id: 'notif-77',
    };

    const notification = {
      id: payload.id,
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      read: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    it('reports outcome=delivered for a first-time notification', async () => {
      addNotificationMock.mockResolvedValue({ notification, inserted: true });

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload, { maxAttempts: 1, backoffMs: 0 });

      expect(result.outcome).toBe('delivered');
      expect(result.delivered).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.attempts).toBe(1);
    });

    it('reports outcome=rejected for an invalid payload without attempting delivery', async () => {
      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(
        { ...payload, userId: '' } as any,
        { maxAttempts: 3, backoffMs: 0 },
      );

      expect(result.outcome).toBe('rejected');
      expect(result.attempts).toBe(0);
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('reports outcome=duplicate and creates nothing when the id already exists', async () => {
      addNotificationMock.mockResolvedValue({ notification, inserted: false });

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload, { maxAttempts: 1, backoffMs: 0 });

      expect(result.outcome).toBe('duplicate');
      expect(result.delivered).toBe(false);
      expect(result.duplicate).toBe(true);
      // A duplicate is terminal, not a failure to retry.
      expect(result.attempts).toBe(1);
    });

    it('reuses the same idempotency key across retries so a retry cannot duplicate the row', async () => {
      addNotificationMock
        .mockRejectedValueOnce(new Error('connection reset'))
        .mockResolvedValueOnce({ notification, inserted: true });

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload, { maxAttempts: 2, backoffMs: 0 });

      expect(result.outcome).toBe('delivered');
      expect(result.attempts).toBe(2);
      expect(addNotificationMock).toHaveBeenCalledTimes(2);

      const ids = addNotificationMock.mock.calls.map((call) => (call[1] as any).id);
      expect(ids[0]).toBe(payload.id);
      expect(new Set(ids).size).toBe(1);
    });

    it('skips delivery when the user opted out, without retrying or erroring', async () => {
      const isDeliveryEnabled = vi.fn().mockResolvedValue(false);

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload, {
        maxAttempts: 3,
        backoffMs: 0,
        isDeliveryEnabled,
      });

      expect(result.outcome).toBe('skipped');
      expect(result.delivered).toBe(false);
      expect(result.attempts).toBe(0);
      expect(isDeliveryEnabled).toHaveBeenCalledWith(payload.userId, payload.type);
      expect(addNotificationMock).not.toHaveBeenCalled();
    });

    it('delivers when the preference lookup permits delivery', async () => {
      const isDeliveryEnabled = vi.fn().mockResolvedValue(true);
      addNotificationMock.mockResolvedValue({ notification, inserted: true });

      const { handleNotificationJob } = await import('./notifications.worker');
      const result = await handleNotificationJob(payload, {
        maxAttempts: 1,
        backoffMs: 0,
        isDeliveryEnabled,
      });

      expect(result.outcome).toBe('delivered');
      expect(isDeliveryEnabled).toHaveBeenCalledTimes(1);
    });

    it('fails after exhausting retries, preserving the error for the dead-letter queue', async () => {
      addNotificationMock.mockRejectedValue(new Error('database unavailable'));

      const { handleNotificationJob } = await import('./notifications.worker');

      await expect(
        handleNotificationJob(payload, { maxAttempts: 3, backoffMs: 0 }),
      ).rejects.toThrow('database unavailable');

      expect(addNotificationMock).toHaveBeenCalledTimes(3);
    });

    it('treats a single-attempt run as terminal on failure', async () => {
      addNotificationMock.mockRejectedValue(new Error('boom'));

      const { handleNotificationJob } = await import('./notifications.worker');

      await expect(
        handleNotificationJob(payload, { maxAttempts: 1, backoffMs: 0 }),
      ).rejects.toThrow('boom');
      expect(addNotificationMock).toHaveBeenCalledTimes(1);
    });
  });
});
