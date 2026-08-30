/**
 * Re-export wrapper for backward compatibility.
 *
 * The canonical module is now `@/lib/audit`. Import from there directly for
 * new code; this file re-exports the legacy API so existing callers keep
 * working without changes.
 */

export type {
  AuditStatus,
  TransactionAuditEvent as AuditEvent,
  AuditAction,
  AdminAuditEvent,
} from '@/lib/audit';

import {
  appendTransactionAuditEvent as _appendAuditEvent,
  getTransactionAuditEvents as _getAuditEvents,
  clearAuditLog as _clearAuditEventsForTests,
  hashIp as _hashIp,
  redactAuditPayload as _redactAuditPayload,
  emitAdminAuditEvent as _emitAuditEvent,
  auditAdminUsersRead as _auditAdminUsersRead,
} from '@/lib/audit';

import type { TransactionAuditEvent, AuditAction, AuditStatus } from '@/lib/audit';

export function hashIp(ip?: string | null): string | null {
  return _hashIp(ip);
}

export function redactAuditPayload<T extends Record<string, unknown>>(
  payload: T,
): Partial<T> {
  return _redactAuditPayload(payload);
}

export async function appendAuditEvent(
  event: Omit<TransactionAuditEvent, 'createdAt' | 'kind'>,
): Promise<TransactionAuditEvent> {
  return _appendAuditEvent(event);
}

export function getAuditEvents(): TransactionAuditEvent[] {
  return _getAuditEvents();
}

export function clearAuditEventsForTests(): void {
  _clearAuditEventsForTests();
}

export function emitAuditEvent(
  action: AuditAction,
  actorId: string,
  context?: Record<string, unknown>,
): void {
  _emitAuditEvent(action, actorId, context);
}

export function auditAdminUsersRead(
  actorId: string,
  queryParams: Record<string, unknown>,
): void {
  _auditAdminUsersRead(actorId, queryParams);
}
