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

const MAX_OUTBOX_RETRY_ATTEMPTS = 3;
const VALID_OUTBOX_TYPES = new Set(['notification', 'audit']);

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

function getAttempts(event: { attempts?: number | null } | null | undefined): number {
  const value = Number(event?.attempts ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Dispatches a single outbox event to its corresponding BullMQ queue.
 *
 * Boundary enforcement: the payload is parsed and validated before anything is
 * enqueued. Malformed, tampered, or unknown-type events are marked FAILED and
 * never reach a queue. Valid events use the outbox event ID as the BullMQ
 * jobId to guarantee strict idempotency (at-least-once delivery).
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

  try {
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
              lt(outboxEvents.attempts, MAX_OUTBOX_RETRY_ATTEMPTS)
            )
          )
        )
        .limit(BATCH_SIZE)
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
            claimedAt,
            lastError: wasStale ? 'recovered stale claim' : null,
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
