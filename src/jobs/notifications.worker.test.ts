import { beforeEach, describe, expect, it, vi } from 'vitest';

const addNotificationMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/lib/notifications/repository', () => ({
  addNotification: addNotificationMock,
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
      id: payload.id,
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      read: false,
      createdAt: '2026-01-01T00:00:00.000Z',
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
        id: payload.id,
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        read: false,
        createdAt: '2026-01-01T00:00:00.000Z',
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

    addNotificationMock.mockRejectedValueOnce(new Error('duplicate notification already sent'));

    const { handleNotificationJob } = await import('./notifications.worker');
    const result = await handleNotificationJob(payload, { maxAttempts: 1, backoffMs: 0 });

    expect(result.delivered).toBe(false);
    expect(result.duplicate).toBe(true);
    expect(addNotificationMock).toHaveBeenCalledTimes(1);
  });
});
