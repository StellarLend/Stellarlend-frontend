import { Queue, Worker } from 'bullmq';
import { db } from '@/lib/db/client';
import { outboxEvents } from '@/lib/db/schema';
import { eq, and, or, lt, isNull } from 'drizzle-orm';
import { addNotification } from '@/lib/notifications/repository';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import {
  parseOutboxPayload,
  OutboxPayloadValidationError,
  NotificationOutboxPayloadSchema,
  AuditOutboxPayloadSchema,
} from '@/lib/validation/outbox';
import type { OutboxPayload } from '@/lib/validation/outbox';

const ROUTE = 'jobs/outbox-dispatcher';

// Redis connection options (pulled from environment)
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

/** Maximum dispatch attempts before an event is left FAILED (bounded retries). */
export const MAX_ATTEMPTS = 3;
/**
 * Lease duration for a PROCESSING claim. Events that crash between claim and
 * dispatch stay PROCESSING; after the lease expires they are re-claimed, which
 * gives safe recovery after partial failures.
 */
export const CLAIM_LEASE_MS = 60_000;
export const BATCH_SIZE = 10;
const LAST_ERROR_MAX_LENGTH = 500;

/**
 * Visibility counters for the dispatcher (exported for tests/monitoring).
 */
export const dispatcherMetrics = {
  dispatched: 0,
  rejected: 0,
  failed: 0,
  recoveredStale: 0,
};

// Define BullMQ Queues
export const notificationQueue = new Queue('notification-queue', { connection });
export const auditQueue = new Queue('audit-queue', { connection });

function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > LAST_ERROR_MAX_LENGTH
    ? `${message.slice(0, LAST_ERROR_MAX_LENGTH)}…`
    : message;
}

async function markFailed(eventId: string, attempts: number, error: string): Promise<void> {
  await db
    .update(outboxEvents)
    .set({
      status: 'FAILED',
      attempts,
      lastError: truncateError(error),
    })
    .where(eq(outboxEvents.id, eventId));
}

async function markCompleted(eventId: string): Promise<void> {
  await db
    .update(outboxEvents)
    .set({
      status: 'COMPLETED',
      processedAt: new Date(),
    })
    .where(eq(outboxEvents.id, eventId));
}

/**
 * Dispatches a single outbox event to its corresponding BullMQ queue.
 *
 * Boundary enforcement: the payload is parsed and validated before anything is
 * enqueued. Malformed, tampered, or unknown-type events are marked FAILED and
 * never reach a queue. Valid events use the outbox event ID as the BullMQ
 * jobId to guarantee strict idempotency (at-least-once delivery).
 */
export async function dispatchEvent(event: typeof outboxEvents.$inferSelect): Promise<void> {
  let payload: OutboxPayload;
  try {
    payload = parseOutboxPayload(event.type, event.payload);
  } catch (error) {
    const reason =
      error instanceof OutboxPayloadValidationError ? error.message : truncateError(error);
    await markFailed(event.id, event.attempts + 1, `rejected: ${reason}`);
    dispatcherMetrics.rejected += 1;
    logger.warn('Outbox event rejected at validation boundary', ROUTE, {
      eventId: event.id,
      type: event.type,
      reason,
    });
    return;
  }

  try {
    if (event.type === 'notification') {
      await notificationQueue.add('send_notification', payload, {
        jobId: event.id, // Idempotency key
      });
    } else if (event.type === 'audit') {
      await auditQueue.add('log_audit', payload, {
        jobId: event.id, // Idempotency key
      });
    }

    // Mark as COMPLETED in DB upon successful enqueue
    await markCompleted(event.id);
    dispatcherMetrics.dispatched += 1;
    logger.info('Outbox event dispatched', ROUTE, {
      eventId: event.id,
      type: event.type,
      attempts: event.attempts,
    });
  } catch (error) {
    // Record failure details and increment attempts (bounded by MAX_ATTEMPTS
    // in the claim query so a permanently failing event stops being retried).
    await markFailed(event.id, event.attempts + 1, truncateError(error));
    dispatcherMetrics.failed += 1;
    logger.error('Outbox event dispatch failed', ROUTE, {
      eventId: event.id,
      type: event.type,
      attempts: event.attempts + 1,
      error: truncateError(error),
    });
  }
}

let running = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Polls the database for events that need dispatch:
 * - PENDING events
 * - FAILED events with retry attempts remaining (bounded retries)
 * - PROCESSING events whose claim lease expired (safe recovery after crashes)
 *
 * Claimed events are transitioned to PROCESSING with a lease timestamp inside
 * a transaction to prevent double dispatch.
 */
export async function processOutbox() {
  if (running) return;
  running = true;

  try {
    const staleCutoff = new Date(Date.now() - CLAIM_LEASE_MS);

    const events = db.transaction((tx) => {
      const pending = tx
        .select()
        .from(outboxEvents)
        .where(
          or(
            eq(outboxEvents.status, 'PENDING'),
            and(
              eq(outboxEvents.status, 'FAILED'),
              lt(outboxEvents.attempts, MAX_ATTEMPTS)
            ),
            // Stale lease recovery: PROCESSING events whose lease expired
            // (crash between claim and dispatch) or that predate lease
            // tracking are re-claimed.
            and(
              eq(outboxEvents.status, 'PROCESSING'),
              or(
                isNull(outboxEvents.claimedAt),
                lt(outboxEvents.claimedAt, staleCutoff)
              )
            )
          )
        )
        .limit(BATCH_SIZE)
        .all();

      if (pending.length === 0) return [];

      // Transition to PROCESSING inside the transaction to prevent double
      // dispatch, stamping the lease timestamp for crash recovery.
      const claimedAt = new Date();
      for (const event of pending) {
        const wasStale = event.status === 'PROCESSING';
        if (wasStale) {
          dispatcherMetrics.recoveredStale += 1;
        }
        tx
          .update(outboxEvents)
          .set({
            status: 'PROCESSING',
            claimedAt,
            lastError: wasStale ? 'recovered stale claim' : null,
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
    logger.error('Error in outbox dispatcher loop', ROUTE, { error: String(err) });
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

/**
 * Notification consumer. Re-validates the job payload at the consumer boundary
 * (defense in depth) so a tampered job cannot inject notifications; invalid
 * jobs are rejected loudly instead of producing side effects.
 */
export const notificationWorker = new Worker(
  'notification-queue',
  async (job) => {
    const parsed = NotificationOutboxPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      logger.error('Notification consumer rejected invalid job', ROUTE, {
        jobId: job.id,
        reason,
      });
      throw new Error(`Invalid notification job payload: ${reason}`);
    }

    const { userId, title, message, type, id } = parsed.data;
    await addNotification(userId, {
      id: id || job.id || crypto.randomUUID(),
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    });
  },
  { connection }
);

/**
 * Audit consumer. Re-validates the job payload at the consumer boundary and
 * rejects tampered jobs instead of writing them to the audit log.
 */
export const auditWorker = new Worker(
  'audit-queue',
  async (job) => {
    const parsed = AuditOutboxPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      logger.error('Audit consumer rejected invalid job', ROUTE, {
        jobId: job.id,
        reason,
      });
      throw new Error(`Invalid audit job payload: ${reason}`);
    }

    const { userId, action, details, timestamp } = parsed.data;
    logger.info(`AUDIT LOG [${action}]`, 'jobs/consumers', {
      userId,
      details,
      timestamp,
    });
  },
  { connection }
);
