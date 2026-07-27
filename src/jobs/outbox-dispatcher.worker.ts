import { Queue, Worker } from 'bullmq';
import { db } from '@/lib/db/client';
import { outboxEvents } from '@/lib/db/schema';
import { eq, and, or, lt } from 'drizzle-orm';
import { addNotification } from '@/lib/notifications/repository';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Redis connection options (pulled from environment)
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

// Define BullMQ Queues
export const notificationQueue = new Queue('notification-queue', { connection });
export const auditQueue = new Queue('audit-queue', { connection });

/**
 * Dispatches a single outbox event to its corresponding BullMQ queue.
 * Sets the BullMQ jobId to the outbox event ID to ensure strict idempotency (at-least-once delivery).
 */
export async function dispatchEvent(event: typeof outboxEvents.$inferSelect) {
  try {
    const payload = JSON.parse(event.payload);

    if (event.type === 'notification') {
      await notificationQueue.add('send_notification', payload, {
        jobId: event.id, // Idempotency key
      });
    } else if (event.type === 'audit') {
      await auditQueue.add('log_audit', payload, {
        jobId: event.id, // Idempotency key
      });
    } else {
      throw new Error(`Unknown event type: ${event.type}`);
    }

    // Mark as COMPLETED in DB upon successful enqueue
    await db
      .update(outboxEvents)
      .set({
        status: 'COMPLETED',
        processedAt: new Date(),
      })
      .where(eq(outboxEvents.id, event.id));
  } catch (error: any) {
    // Record failure details and increment attempts
    await db
      .update(outboxEvents)
      .set({
        status: 'FAILED',
        attempts: event.attempts + 1,
        lastError: error.message || String(error),
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
              lt(outboxEvents.attempts, 3)
            )
          )
        )
        .limit(10)
        .all();

      if (pending.length === 0) return [];

      // Transition to PROCESSING inside transaction to prevent double dispatch
      for (const event of pending) {
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
      await dispatchEvent(event);
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
