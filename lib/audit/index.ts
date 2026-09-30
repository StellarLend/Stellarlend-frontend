import crypto from 'crypto';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditStatus = 'success' | 'failure';

export type AccountAuditEventType =
  | 'account.deleted'
  | 'account.anonymized'
  | 'sessions.revoked'
  | 'data.cleanup.enqueued'
  | 'data.cleanup.completed'
  | 'data.cleanup.failed'
  | 'auth.challenge.issued'
  | 'auth.challenge.verified'
  | 'auth.challenge.rate_limited';

export interface AccountAuditEvent {
  kind: 'account';
  id: string;
  type: AccountAuditEventType;
  userId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface TransactionAuditEvent {
  kind: 'transaction';
  actorWallet?: string | null;
  action: string;
  resource: string;
  status: AuditStatus;
  requestId?: string | null;
  ipHash?: string | null;
  createdAt: string;
}

export type AuditEvent = AccountAuditEvent | TransactionAuditEvent;

// ---------------------------------------------------------------------------
// Admin audit (write-only, to stdout — not stored in the in-memory ring)
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'admin.users.read'
  | 'admin.users.export'
  | 'admin.user.view'
  | 'admin.user.update'
  | 'admin.user.suspend';

export interface AdminAuditEvent {
  type: 'AUDIT';
  timestamp: string;
  action: AuditAction;
  actorId: string;
  context?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// In-memory ring buffer with max-size eviction
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_AUDIT_EVENTS = 10_000;

let maxEvents = DEFAULT_MAX_AUDIT_EVENTS;
const auditLog: AuditEvent[] = [];
let eventIdCounter = 0;

const MAX_AUDIT_PAYLOAD_BYTES = 4 * 1024;
const MAX_AUDIT_PREVIEW_BYTES = 1_024;

function generateId(): string {
  eventIdCounter += 1;
  return `audit-${Date.now()}-${eventIdCounter}`;
}

function evict(): void {
  if (auditLog.length > maxEvents) {
    auditLog.splice(0, auditLog.length - maxEvents);
  }
}

function sanitizeAuditPayload(
  payload?: Record<string, unknown>,
): Record<string, unknown> {
  if (!payload) {
    return {};
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return {
      __truncated: true,
      __reason: 'audit payload could not be serialized',
    };
  }

  if (serialized.length <= MAX_AUDIT_PAYLOAD_BYTES) {
    return payload;
  }

  return {
    __truncated: true,
    __reason: 'audit payload exceeded maximum size',
    __originalSizeBytes: serialized.length,
    preview: serialized.slice(0, MAX_AUDIT_PREVIEW_BYTES),
  };
}

// ---------------------------------------------------------------------------
// Account audit events (stored in-memory with eviction)
// ---------------------------------------------------------------------------

export function emitAccountAuditEvent(
  type: AccountAuditEventType,
  userId: string,
  metadata: Record<string, unknown> = {},
): AccountAuditEvent {
  const event: AccountAuditEvent = {
    kind: 'account',
    id: generateId(),
    type,
    userId,
    timestamp: new Date().toISOString(),
    metadata: sanitizeAuditPayload(metadata),
  };

  auditLog.push(event);
  evict();

  logger.info(`audit: ${type}`, '/api/audit', {
    eventId: event.id,
    userId,
    type,
  });

  return event;
}

// ---------------------------------------------------------------------------
// Transaction audit events (stored in-memory with eviction)
// ---------------------------------------------------------------------------

export async function appendTransactionAuditEvent(
  event: Omit<TransactionAuditEvent, 'createdAt' | 'kind'>,
): Promise<TransactionAuditEvent> {
  const row: TransactionAuditEvent = {
    ...event,
    kind: 'transaction',
    createdAt: new Date().toISOString(),
  };

  auditLog.push(row);
  evict();

  return row;
}

// ---------------------------------------------------------------------------
// Query / clear
// ---------------------------------------------------------------------------

export function getAllAuditEvents(): AuditEvent[] {
  return [...auditLog];
}

export function getAccountAuditEvents(filters?: {
  userId?: string;
  type?: AccountAuditEventType;
  since?: string;
}): AccountAuditEvent[] {
  let events = auditLog.filter(
    (e): e is AccountAuditEvent => e.kind === 'account',
  );

  if (filters?.userId) {
    events = events.filter((e) => e.userId === filters.userId);
  }
  if (filters?.type) {
    events = events.filter((e) => e.type === filters.type);
  }
  if (filters?.since) {
    const sinceDate = new Date(filters.since).getTime();
    events = events.filter(
      (e) => new Date(e.timestamp).getTime() >= sinceDate,
    );
  }

  return events;
}

export function getTransactionAuditEvents(): TransactionAuditEvent[] {
  return auditLog.filter(
    (e): e is TransactionAuditEvent => e.kind === 'transaction',
  );
}

export function clearAuditLog(): void {
  auditLog.length = 0;
  eventIdCounter = 0;
}

// ---------------------------------------------------------------------------
// Admin audit (writes JSON line to stdout)
// ---------------------------------------------------------------------------

export function emitAdminAuditEvent(
  action: AuditAction,
  actorId: string,
  context?: Record<string, unknown>,
): void {
  const event: AdminAuditEvent = {
    type: 'AUDIT',
    timestamp: new Date().toISOString(),
    action,
    actorId,
    context: sanitizeAuditPayload(context),
  };

  process.stdout.write(JSON.stringify(event) + '\n');
}

export function auditAdminUsersRead(
  actorId: string,
  queryParams: Record<string, unknown>,
): void {
  emitAdminAuditEvent('admin.users.read', actorId, { queryParams });
}

// ---------------------------------------------------------------------------
// Utilities (moved from logger.ts)
// ---------------------------------------------------------------------------

export function hashIp(ip?: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export function redactAuditPayload<T extends Record<string, unknown>>(
  payload: T,
): Partial<T> {
  const blocked = new Set([
    'password',
    'token',
    'secret',
    'transaction',
    'signedEnvelopeXdr',
  ]);

  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !blocked.has(key)),
  ) as Partial<T>;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export function setMaxAuditEventsForTests(max: number): void {
  maxEvents = max;
}

export function resetMaxAuditEventsForTests(): void {
  maxEvents = DEFAULT_MAX_AUDIT_EVENTS;
}
