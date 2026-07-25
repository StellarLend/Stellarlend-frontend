import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import serverConfig from '@/lib/server-config';
import { addNotification } from '@/lib/notifications/repository';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import {
  NotificationsJobPayload,
  notificationsDeadLetterQueue,
  queueNames,
  registerQueueShutdownHooks,
} from '@/lib/queue';

const ROUTE = 'jobs/notifications.worker';
const redisUrl = serverConfig.redisUrl;

export interface NotificationJobResult {
  delivered: boolean;
  duplicate: boolean;
  attempts: number;
}

export interface NotificationJobOptions {
  maxAttempts?: number;
  backoffMs?: number;
}

function isDuplicateNotificationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('duplicate') || message.includes('already sent');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleNotificationJob(
  notification: NotificationsJobPayload & { id?: string },
  options: NotificationJobOptions = {},
): Promise<NotificationJobResult> {
  const { userId, title, message, type, id } = notification;
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffMs = options.backoffMs ?? 1_000;

  if (!userId || !title || !message || !type) {
    throw new Error('Missing required notification fields: userId, title, message, type');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      logger.info(`Processing notification job for user ${userId}`, ROUTE);
      await Promise.resolve(
        addNotification(userId, {
          id: id || crypto.randomUUID(),
          title,
          message,
          type,
          read: false,
          createdAt: new Date().toISOString(),
        }),
      );
      return { delivered: true, duplicate: false, attempts: attempt };
    } catch (error) {
      if (isDuplicateNotificationError(error)) {
        logger.warn(`Notification already sent for user ${userId}`, ROUTE, {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { delivered: false, duplicate: true, attempts: attempt };
      }

      if (attempt < maxAttempts) {
        logger.warn(`Notification delivery failed for user ${userId}; retrying`, ROUTE, {
          userId,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
        await delay(backoffMs);
        continue;
      }

      throw error;
    }
  }

  throw new Error('Notification delivery failed without a result');
}

export const notificationsWorkerConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const notificationsWorker = new Worker(
  queueNames.notifications,
  async (job: Job<NotificationsJobPayload>) => {
    return handleNotificationJob({
      ...job.data,
      id: job.id || crypto.randomUUID(),
    });
  },
  {
    connection: notificationsWorkerConnection,
  }
);

// Dead-letter / Failed job handling
notificationsWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await notificationsDeadLetterQueue.add(
      'send_notification_failed',
      {
        originalJobId: job.id,
        data: job.data,
        failedReason: err.message,
        failedAt: new Date().toISOString(),
      },
      { removeOnComplete: 1_000, removeOnFail: 10_000 },
    );
  }

  logger.error(`Notification job ${job?.id} failed:`, ROUTE, {
    jobId: job?.id,
    data: job?.data,
    error: err.message,
  });
});

export async function gracefulShutdownNotificationsWorker(): Promise<void> {
  await notificationsWorker.close();
  await notificationsWorkerConnection.quit();
}

registerQueueShutdownHooks();
