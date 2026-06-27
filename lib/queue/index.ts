import { JobsOptions, Queue } from 'bullmq';
import Redis from 'ioredis';
import serverConfig from '@/lib/server-config';
import { logger } from '@/lib/logger';

const ROUTE = 'lib/queue';

export interface IndexerJobPayload {
  accountId: string;
}

export interface NotificationsJobPayload {
  userId: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

export interface QueuePayloadMap {
  indexer: IndexerJobPayload;
  notifications: NotificationsJobPayload;
}

export type QueueName = keyof QueuePayloadMap;

export const queueNames = {
  indexer: 'indexer-queue',
  notifications: 'notifications-queue',
  indexerDeadLetter: 'indexer-dead-letter-queue',
  notificationsDeadLetter: 'notifications-dead-letter-queue',
} as const;

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1_000,
  },
  removeOnComplete: 1_000,
  removeOnFail: false,
};

const redisUrl = serverConfig.redisUrl;

export const sharedRedisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const indexerQueue = new Queue(queueNames.indexer, {
  connection: sharedRedisConnection as any,
  defaultJobOptions,
});

export const notificationsQueue = new Queue(queueNames.notifications, {
  connection: sharedRedisConnection as any,
  defaultJobOptions,
});

export const indexerDeadLetterQueue = new Queue(queueNames.indexerDeadLetter, {
  connection: sharedRedisConnection as any,
  defaultJobOptions: {
    removeOnComplete: 1_000,
    removeOnFail: 10_000,
  },
});

export const notificationsDeadLetterQueue = new Queue(queueNames.notificationsDeadLetter, {
  connection: sharedRedisConnection as any,
  defaultJobOptions: {
    removeOnComplete: 1_000,
    removeOnFail: 10_000,
  },
});

const queueByName: { [K in QueueName]: Queue<QueuePayloadMap[K]> } = {
  indexer: indexerQueue,
  notifications: notificationsQueue,
};

const jobByQueueName = {
  indexer: 'index_account',
  notifications: 'send_notification',
} as const;

export async function enqueue<K extends QueueName>(
  queueName: K,
  data: QueuePayloadMap[K],
  options?: JobsOptions,
): Promise<void> {
  const queue = queueByName[queueName];
  const jobName = jobByQueueName[queueName];

  await queue.add(jobName as any, data as any, options);
}

let shutdownHooksRegistered = false;

export function registerQueueShutdownHooks(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const shutdown = async (signal: string) => {
    try {
      logger.info(`Received ${signal}, shutting down queues`, ROUTE);
      await gracefulShutdown();
    } catch (error) {
      logger.error('Failed to gracefully shutdown queue resources', ROUTE, {
        signal,
        error: String(error),
      });
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

export async function gracefulShutdown(): Promise<void> {
  await Promise.all([
    indexerQueue.close(),
    notificationsQueue.close(),
    indexerDeadLetterQueue.close(),
    notificationsDeadLetterQueue.close(),
  ]);
  await sharedRedisConnection.quit();
}
