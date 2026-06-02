/**
 * lib/audit/logger.ts
 *
 * Lightweight structured audit-event emitter for Stellarlend admin operations.
 *
 * All audit events are written to stdout as newline-delimited JSON (NDJSON) so
 * they can be collected by any standard log aggregation system (Datadog,
 * CloudWatch, Loki, etc.).
 *
 * Events intentionally never include:
 *   - Passwords or hashed credentials
 *   - Raw session tokens
 *   - Private keys
 */

export type AuditAction =
  | 'admin.users.read'
  | 'admin.users.export'
  | 'admin.user.view'
  | 'admin.user.update'
  | 'admin.user.suspend';

export interface AuditEvent {
  /** Fixed tag for log routing / filtering. */
  type: 'AUDIT';
  /** ISO-8601 UTC timestamp. */
  timestamp: string;
  /** The action that was performed. */
  action: AuditAction;
  /** ID of the admin user who triggered the event. */
  actorId: string;
  /** Additional context (query params, resource IDs, etc.). */
  context?: Record<string, unknown>;
}

/**
 * Emit a structured audit event to stdout.
 *
 * @param action  - The action being audited.
 * @param actorId - The admin user who performed the action.
 * @param context - Optional structured context (query params, affected IDs, etc.).
 */
export function emitAuditEvent(
  action: AuditAction,
  actorId: string,
  context?: Record<string, unknown>,
): void {
  const event: AuditEvent = {
    type: 'AUDIT',
    timestamp: new Date().toISOString(),
    action,
    actorId,
    context,
  };

  // NDJSON – one event per line, safe for log aggregators
  process.stdout.write(JSON.stringify(event) + '\n');
}

/**
 * Convenience wrapper: audit an admin users list read.
 */
export function auditAdminUsersRead(
  actorId: string,
  queryParams: Record<string, unknown>,
): void {
  emitAuditEvent('admin.users.read', actorId, { queryParams });
}
