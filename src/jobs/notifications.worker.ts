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
import {
  validateNotificationPayload,
  sanitizeNotificationId,
  sanitizeUserId,
} from '@/lib/validation/notifications';

const ROUTE = 'jobs/notifications.worker';
const redisUrl = serverConfig.redisUrl;

export interface NotificationJobResult {
  delivered: boolean;
  duplicate: boolean;
  attempts: number;
  validationError?: string;
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

export function validateJobPayload(
  notification: NotificationsJobPayload & { id?: string },
): { valid: boolean; error?: string; sanitized?: NotificationsJobPayload & { id?: string } } {
  const validation = validateNotificationPayload({
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    id: notification.id,
  });

  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  const sanitized: NotificationsJobPayload & { id?: string } = {
    userId: sanitizeUserId(notification.userId as string),
    title: (notification.title as string).trim(),
    message: (notification.message as string).trim(),
    type: notification.type,
  };

  if (notification.id !== undefined) {
    sanitized.id = sanitizeNotificationId(notification.id as string);
  }

  return { valid: true, sanitized };
}

export async function handleNotificationJob(
  notification: NotificationsJobPayload & { id?: string },
  options: NotificationJobOptions = {},
): Promise<NotificationJobResult> {
  const validation = validateJobPayload(notification);
  if (!validation.valid || !validation.sanitized) {
    logger.warn('Invalid notification job payload rejected', ROUTE, {
      error: validation.error,
      userId: String(notification.userId).slice(0, 50),
    });
    return { delivered: false, duplicate: false, attempts: 0, validationError: validation.error };
  }

  const { userId, title, message, type, id } = validation.sanitized;
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffMs = options.backoffMs ?? 1_000;

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
    const { userId, title, message, type } = job.data;
    if (!userId || !title || !message || !type) {
      throw new Error('Missing required notification fields: userId, title, message, type');
    }
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
