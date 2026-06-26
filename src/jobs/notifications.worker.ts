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

export const notificationsWorkerConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const notificationsWorker = new Worker(
  queueNames.notifications,
  async (job: Job<NotificationsJobPayload>) => {
    const { userId, title, message, type } = job.data;
    if (!userId || !title || !message || !type) {
      throw new Error('Missing required notification fields: userId, title, message, type');
    }

    logger.info(`Processing notification job for user ${userId}`, ROUTE);
    await Promise.resolve(
      addNotification(userId, {
      id: job.id || crypto.randomUUID(),
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      }),
    );
  },
  {
    connection: notificationsWorkerConnection as any,
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
