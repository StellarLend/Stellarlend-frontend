import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import serverConfig from '@/lib/server-config';
import { addNotificationWithOutcome } from '@/lib/notifications/repository';
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

/**
 * Terminal state of a single delivery attempt chain.
 *
 * - `delivered`  the row was created by this run
 * - `duplicate`  the notification already existed; nothing was created
 * - `rejected`   the payload failed validation and will never be retried
 * - `skipped`    delivery was suppressed, e.g. the user opted out
 * - `failed`     every attempt errored; the job is handed to the DLQ
 *
 * The chain always terminates in exactly one of these. Only `rejected` is
 * final without a delivery attempt, and only `failed` exhausts retries.
 */
export type NotificationDeliveryOutcome =
  | 'delivered'
  | 'duplicate'
  | 'rejected'
  | 'skipped'
  | 'failed';

export interface NotificationJobResult {
  delivered: boolean;
  duplicate: boolean;
  attempts: number;
  validationError?: string;
  /** Terminal state of the chain. */
  outcome: NotificationDeliveryOutcome;
}

export interface NotificationJobOptions {
  maxAttempts?: number;
  backoffMs?: number;
  /**
   * Consulted before every delivery attempt. Returning false suppresses the
   * notification, which is reported as `skipped` rather than `failed`, so an
   * opt-out is never retried and never surfaces as an error to the user.
   */
  isDeliveryEnabled?: (userId: string, type: string) => Promise<boolean> | boolean;
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
    return {
      delivered: false,
      duplicate: false,
      attempts: 0,
      validationError: validation.error,
      outcome: 'rejected',
    };
  }

  const { userId, title, message, type, id } = validation.sanitized;
  const maxAttempts = options.maxAttempts ?? 3;
  const backoffMs = options.backoffMs ?? 1_000;
  const isDeliveryEnabled = options.isDeliveryEnabled;

  if (isDeliveryEnabled && !(await isDeliveryEnabled(userId, type))) {
    logger.info(`Notification skipped: delivery disabled for user ${userId}`, ROUTE, {
      userId,
      type,
    });
    return { delivered: false, duplicate: false, attempts: 0, outcome: 'skipped' };
  }

  // The notification id is the idempotency key. Reusing it across attempts
  // guarantees a retry converges on the same row instead of a second one.
  const notificationId = id || crypto.randomUUID();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      logger.info(`Processing notification job for user ${userId}`, ROUTE);
      const { inserted } = await Promise.resolve(
        addNotificationWithOutcome(userId, {
          id: notificationId,
          title,
          message,
          type,
          read: false,
          createdAt: new Date().toISOString(),
        }),
      );

      if (!inserted) {
        logger.warn(`Notification already sent for user ${userId}`, ROUTE, {
          userId,
          id: notificationId,
        });
        return { delivered: false, duplicate: true, attempts: attempt, outcome: 'duplicate' };
      }

      return { delivered: true, duplicate: false, attempts: attempt, outcome: 'delivered' };
    } catch (error) {
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
