/**
 * Re-export wrapper for backward compatibility.
 *
 * The canonical module is now `@/lib/audit`. Import from there directly for
 * new code; this file re-exports the legacy API so existing callers keep
 * working without changes.
 */

export type {
  AccountAuditEventType as AuditEventType,
  AccountAuditEvent as AuditEvent,
} from '@/lib/audit';

import {
  emitAccountAuditEvent as _emitAuditEvent,
  getAccountAuditEvents as _getAccountEvents,
  clearAuditLog as _clearAuditLog,
} from '@/lib/audit';

import type { AccountAuditEventType, AccountAuditEvent } from '@/lib/audit';

export function emitAuditEvent(
  type: AccountAuditEventType,
  userId: string,
  metadata: Record<string, unknown> = {},
): AccountAuditEvent {
  return _emitAuditEvent(type, userId, metadata);
}

export function getAuditEvents(filters?: {
  userId?: string;
  type?: AccountAuditEventType;
  since?: string;
}): AccountAuditEvent[] {
  return _getAccountEvents(filters);
}

export function clearAuditLog(): void {
  _clearAuditLog();
}
