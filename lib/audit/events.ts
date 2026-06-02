import { logger } from '@/lib/logger';

export type AuditEventType =
  | 'account.deleted'
  | 'account.anonymized'
  | 'sessions.revoked'
  | 'data.cleanup.enqueued'
  | 'data.cleanup.completed'
  | 'data.cleanup.failed'
  | 'auth.challenge.issued'
  | 'auth.challenge.verified';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  userId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

const auditLog: AuditEvent[] = [];
let eventIdCounter = 0;

function generateId(): string {
  eventIdCounter += 1;
  return `audit-${Date.now()}-${eventIdCounter}`;
}

export function emitAuditEvent(
  type: AuditEventType,
  userId: string,
  metadata: Record<string, unknown> = {}
): AuditEvent {
  const event: AuditEvent = {
    id: generateId(),
    type,
    userId,
    timestamp: new Date().toISOString(),
    metadata,
  };

  auditLog.push(event);

  logger.info(`audit: ${type}`, '/api/audit', {
    eventId: event.id,
    userId,
    type,
  });

  return event;
}

export function getAuditEvents(filters?: {
  userId?: string;
  type?: AuditEventType;
  since?: string;
}): AuditEvent[] {
  let events = auditLog;

  if (filters?.userId) {
    events = events.filter((e) => e.userId === filters.userId);
  }
  if (filters?.type) {
    events = events.filter((e) => e.type === filters.type);
  }
  if (filters?.since) {
    const sinceDate = new Date(filters.since).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() >= sinceDate);
  }

  return events;
}

export function clearAuditLog(): void {
  auditLog.length = 0;
  eventIdCounter = 0;
}
