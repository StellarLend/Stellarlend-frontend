import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('ioredis', () => ({
  default: class MockRedis {
    quit = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('bullmq', () => {
  class MockQueue {
    static instances: Record<string, MockQueue> = {};
    name: string;
    jobs: Array<{ name: string; data: unknown; opts?: unknown }> = [];
    close = vi.fn().mockResolvedValue(undefined);

    constructor(name: string) {
      this.name = name;
      MockQueue.instances[name] = this;
    }

    async add(name: string, data: unknown, opts?: unknown) {
      const job = { name, data, opts };
      this.jobs.push(job);
      return job;
    }
  }

  class MockWorker {
    static instances: Record<string, MockWorker> = {};
    handler: (job: any) => Promise<unknown>;
    listeners: Record<string, Array<(...args: any[]) => unknown>> = {};
    close = vi.fn().mockResolvedValue(undefined);

    constructor(name: string, handler: (job: any) => Promise<unknown>) {
      this.handler = handler;
      MockWorker.instances[name] = this;
    }

    on(event: string, callback: (...args: any[]) => unknown) {
      this.listeners[event] ??= [];
      this.listeners[event].push(callback);
    }

    async emit(event: string, ...args: any[]) {
      const handlers = this.listeners[event] ?? [];
      for (const handler of handlers) {
        await handler(...args);
      }
    }
  }

  return { Queue: MockQueue, Worker: MockWorker };
});

vi.mock('@/lib/indexer', () => ({
  indexAccountTransactions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/notifications/repository', () => ({
  addNotification: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { Queue } from 'bullmq';
import { indexAccountTransactions } from '@/lib/indexer';
import { addNotification } from '@/lib/notifications/repository';
import {
  enqueue,
  gracefulShutdown,
  queueNames,
} from './index';
import {
  gracefulShutdownIndexerWorker,
  indexerWorker,
} from '@/src/jobs/indexer.worker';
import {
  gracefulShutdownNotificationsWorker,
  notificationsWorker,
} from '@/src/jobs/notifications.worker';

describe('BullMQ queue integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const instances = (Queue as any).instances as Record<string, { jobs: unknown[] }>;
    for (const queue of Object.values(instances)) {
      queue.jobs = [];
    }
  });

  it('enqueues indexer jobs on indexer queue', async () => {
    await enqueue('indexer', { accountId: 'G123' });

    const queue = (Queue as any).instances[queueNames.indexer];
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({
      name: 'index_account',
      data: { accountId: 'G123' },
    });
  });

  it('enqueues notification jobs on notifications queue', async () => {
    await enqueue('notifications', {
      userId: 'user-1',
      title: 'Title',
      message: 'Message',
      type: 'info',
    });

    const queue = (Queue as any).instances[queueNames.notifications];
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({
      name: 'send_notification',
      data: {
        userId: 'user-1',
        title: 'Title',
        message: 'Message',
        type: 'info',
      },
    });
  });

  it('processes indexer jobs using skipQueue and bypassCache', async () => {
    const handler = (indexerWorker as any).handler;
    await handler({ data: { accountId: 'GABC' } });

    expect(indexAccountTransactions).toHaveBeenCalledWith('GABC', {
      bypassCache: true,
      skipQueue: true,
    });
  });

  it('processes notification jobs and writes records', async () => {
    const handler = (notificationsWorker as any).handler;

    await handler({
      id: 'notif-job-1',
      data: {
        userId: 'user-1',
        title: 'Ping',
        message: 'Pong',
        type: 'success',
      },
    });

    expect(addNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        id: 'notif-job-1',
        title: 'Ping',
        message: 'Pong',
        type: 'success',
      }),
    );
  });

  it('moves terminal indexer failures to dead-letter queue', async () => {
    await (indexerWorker as any).emit(
      'failed',
      {
        id: 'job-1',
        data: { accountId: 'G999' },
        attemptsMade: 3,
        opts: { attempts: 3 },
      },
      new Error('Indexer exploded'),
    );

    const dlq = (Queue as any).instances[queueNames.indexerDeadLetter];
    expect(dlq.jobs).toHaveLength(1);
    expect(dlq.jobs[0]).toMatchObject({
      name: 'index_account_failed',
    });
  });

  it('moves terminal notification failures to dead-letter queue', async () => {
    await (notificationsWorker as any).emit(
      'failed',
      {
        id: 'job-2',
        data: { userId: 'u1' },
        attemptsMade: 3,
        opts: { attempts: 3 },
      },
      new Error('Notification exploded'),
    );

    const dlq = (Queue as any).instances[queueNames.notificationsDeadLetter];
    expect(dlq.jobs).toHaveLength(1);
    expect(dlq.jobs[0]).toMatchObject({
      name: 'send_notification_failed',
    });
  });

  it('gracefully shuts down queues and workers', async () => {
    await expect(gracefulShutdown()).resolves.not.toThrow();
    await expect(gracefulShutdownIndexerWorker()).resolves.not.toThrow();
    await expect(gracefulShutdownNotificationsWorker()).resolves.not.toThrow();
  });
});
