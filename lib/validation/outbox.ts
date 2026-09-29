/**
 * Outbox payload validation.
 *
 * Enforces the authorization / hostile-input boundary for outbox events before
 * anything is enqueued to BullMQ. Outbox payloads are written by internal
 * transactional code, so malformed JSON, over-sized payloads, invalid shapes,
 * or unknown fields are treated as tampering, replay, or producer bugs and are
 * rejected: the event is marked FAILED and never reaches a downstream queue.
 */

import { z } from 'zod';

export const MAX_OUTBOX_PAYLOAD_BYTES = 64 * 1024; // 64 KB
export const MAX_USER_ID_LENGTH = 256;
export const MAX_TITLE_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_ACTION_LENGTH = 100;
export const MAX_DETAILS_KEYS = 20;

export const OUTBOX_EVENT_TYPES = ['notification', 'audit'] as const;
export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];

export const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const;

const userIdSchema = z
  .string()
  .trim()
  .min(1, 'userId must be a non-empty string')
  .max(MAX_USER_ID_LENGTH, `userId exceeds ${MAX_USER_ID_LENGTH} characters`);

/**
 * Strict schema for `notification` outbox payloads. `.strict()` rejects unknown
 * fields so tampered or drifted producers cannot smuggle data into the queue.
 */
export const NotificationOutboxPayloadSchema = z
  .object({
    userId: userIdSchema,
    title: z
      .string()
      .trim()
      .min(1, 'title must be a non-empty string')
      .max(MAX_TITLE_LENGTH, `title exceeds ${MAX_TITLE_LENGTH} characters`),
    message: z
      .string()
      .trim()
      .min(1, 'message must be a non-empty string')
      .max(MAX_MESSAGE_LENGTH, `message exceeds ${MAX_MESSAGE_LENGTH} characters`),
    type: z.enum(NOTIFICATION_TYPES),
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/, 'id contains invalid characters')
      .optional(),
  })
  .strict();

/**
 * Strict schema for `audit` outbox payloads. `details` is bounded by key count
 * and every value is capped to a maximum serialized length to prevent hostile
 * producers from flooding the audit log.
 */
export const AuditOutboxPayloadSchema = z
  .object({
    userId: userIdSchema,
    action: z
      .string()
      .trim()
      .min(1, 'action must be a non-empty string')
      .max(MAX_ACTION_LENGTH, `action exceeds ${MAX_ACTION_LENGTH} characters`),
    details: z
      .record(z.string(), z.unknown())
      .refine((d) => Object.keys(d).length <= MAX_DETAILS_KEYS, `details exceeds ${MAX_DETAILS_KEYS} keys`)
      .optional(),
    timestamp: z
      .union([
        z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'timestamp must be a valid date string'),
        z.number().int('timestamp must be an integer').positive('timestamp must be positive'),
      ])
      .optional(),
  })
  .strict();

export type NotificationOutboxPayload = z.infer<typeof NotificationOutboxPayloadSchema>;
export type AuditOutboxPayload = z.infer<typeof AuditOutboxPayloadSchema>;
export type OutboxPayload = NotificationOutboxPayload | AuditOutboxPayload;

export class OutboxPayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutboxPayloadValidationError';
  }
}

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/**
 * Parses and validates an outbox event payload at the dispatch boundary.
 *
 * Throws {@link OutboxPayloadValidationError} for unknown event types,
 * malformed JSON, over-sized payloads, and schema violations so the caller can
 * reject the event without enqueueing anything.
 */
export function parseOutboxPayload(type: string, rawPayload: string): OutboxPayload {
  if (typeof rawPayload !== 'string' || rawPayload.length === 0) {
    throw new OutboxPayloadValidationError('payload is missing or not a string');
  }

  if (Buffer.byteLength(rawPayload, 'utf8') > MAX_OUTBOX_PAYLOAD_BYTES) {
    throw new OutboxPayloadValidationError(`payload exceeds ${MAX_OUTBOX_PAYLOAD_BYTES} bytes`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new OutboxPayloadValidationError('payload is not valid JSON');
  }

  if (type === 'notification') {
    const result = NotificationOutboxPayloadSchema.safeParse(parsed);
    if (!result.success) {
      throw new OutboxPayloadValidationError(`invalid notification payload: ${formatZodIssues(result.error)}`);
    }
    return result.data;
  }

  if (type === 'audit') {
    const result = AuditOutboxPayloadSchema.safeParse(parsed);
    if (!result.success) {
      throw new OutboxPayloadValidationError(`invalid audit payload: ${formatZodIssues(result.error)}`);
    }
    return result.data;
  }

  throw new OutboxPayloadValidationError(`Unknown event type: ${type}`);
}
