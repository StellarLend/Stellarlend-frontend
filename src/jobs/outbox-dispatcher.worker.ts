import { Queue, Worker } from 'bullmq';
import { db } from '@/lib/db/client';
import { outboxEvents } from '@/lib/db/schema';
import { eq, and, or, lt } from 'drizzle-orm';
import { addNotification } from '@/lib/notifications/repository';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

const MAX_OUTBOX_RETRY_ATTEMPTS = 3;
const VALID_OUTBOX_TYPES = new Set(['notification', 'audit']);

// Redis connection options (pulled from environment)
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

// Define BullMQ Queues
export const notificationQueue = new Queue('notification-queue', { connection });
export const auditQueue = new Queue('audit-queue', { connection });

function getAttempts(event: { attempts?: number | null } | null | undefined): number {
  const value = Number(event?.attempts ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Dispatches a single outbox event to its corresponding BullMQ queue.
 * Sets the BullMQ jobId to the outbox event ID to ensure strict idempotency (at-least-once delivery).
 */
export async function dispatchEvent(event: typeof outboxEvents.$inferSelect) {
  if (!event?.id || !event.type || !event.payload) {
    throw new Error('Outbox event is missing required fields');
  }

  if (!VALID_OUTBOX_TYPES.has(event.type)) {
    await db
      .update(outboxEvents)
      .set({
        status: 'FAILED',
        attempts: Math.min(getAttempts(event) + 1, MAX_OUTBOX_RETRY_ATTEMPTS),
        lastError: `Unknown event type: ${event.type}`,
      })
      .where(eq(outboxEvents.id, event.id));
    return;
  }

  const attempts = getAttempts(event);
  if (attempts >= MAX_OUTBOX_RETRY_ATTEMPTS) {
    await db
      .update(outboxEvents)
      .set({
        status: 'FAILED',
        lastError: 'Retry limit reached',
      })
      .where(eq(outboxEvents.id, event.id));
    return;
  }

  try {
    const payload = JSON.parse(event.payload);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Outbox payload must be a JSON object');
    }

    if (event.type === 'notification') {
      await notificationQueue.add('send_notification', payload, {
        jobId: event.id,
      });
    } else if (event.type === 'audit') {
      await auditQueue.add('log_audit', payload, {
        jobId: event.id,
      });
    }

    await db
      .update(outboxEvents)
      .set({
        status: 'COMPLETED',
        processedAt: new Date(),
        attempts: Math.max(attempts, 0),
        lastError: null,
      })
      .where(eq(outboxEvents.id, event.id));
  } catch (error: any) {
    const nextAttempts = Math.min(attempts + 1, MAX_OUTBOX_RETRY_ATTEMPTS);
    await db
      .update(outboxEvents)
      .set({
        status: 'FAILED',
        attempts: nextAttempts,
        lastError: error?.message || String(error),
      })
      .where(eq(outboxEvents.id, event.id));
  }
}

let running = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Polls the database for PENDING or FAILED (with retry attempts remaining)
 * events, marks them as PROCESSING inside a transaction, and dispatches them.
 */
export async function processOutbox() {
  if (running) return;
  running = true;

  try {
    const events = db.transaction((tx) => {
      const pending = tx
        .select()
        .from(outboxEvents)
        .where(
          or(
            eq(outboxEvents.status, 'PENDING'),
            and(
              eq(outboxEvents.status, 'FAILED'),
              lt(outboxEvents.attempts, MAX_OUTBOX_RETRY_ATTEMPTS)
            )
          )
        )
        .limit(10)
        .all();

      if (pending.length === 0) return [];

      for (const event of pending) {
        const attempts = getAttempts(event);
        if (attempts >= MAX_OUTBOX_RETRY_ATTEMPTS && event.status === 'FAILED') {
          tx
            .update(outboxEvents)
            .set({
              status: 'FAILED',
              lastError: 'Retry limit reached',
            })
            .where(eq(outboxEvents.id, event.id))
            .run();
          continue;
        }

        tx
          .update(outboxEvents)
          .set({
            status: 'PROCESSING',
          })
          .where(eq(outboxEvents.id, event.id))
          .run();
      }

      return pending;
    });

    for (const event of events) {
      try {
        await dispatchEvent({ ...event, attempts: getAttempts(event) });
      } catch (err) {
        logger.error('Error dispatching outbox event', 'jobs/outbox-dispatcher', {
          eventId: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.error('Error in outbox dispatcher loop', 'jobs/outbox-dispatcher', { error: String(err) });
  } finally {
    running = false;
  }
}

/**
 * Starts the polling loop for the outbox dispatcher.
 */
export function startDispatcher(intervalMs = 1000) {
  if (intervalId) return;
  intervalId = setInterval(processOutbox, intervalMs);
}

/**
 * Stops the polling loop.
 */
export function stopDispatcher() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// ---------------------------------------------------------------------------
// Downstream Queue Consumers (Workers)
// ---------------------------------------------------------------------------

export const notificationWorker = new Worker(
  'notification-queue',
  async (job) => {
    const { userId, title, message, type } = job.data;
    addNotification(userId, {
      id: job.id || crypto.randomUUID(),
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    });
  },
  { connection }
);

export const auditWorker = new Worker(
  'audit-queue',
  async (job) => {
    const { userId, action, details, timestamp } = job.data;
    logger.info(`AUDIT LOG [${action}]`, 'jobs/consumers', {
      userId,
      details,
      timestamp,
    });
  },
  { connection }
);
