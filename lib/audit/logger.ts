import crypto from 'crypto';

export type AuditStatus = 'success' | 'failure';

export interface AuditEvent {
  actorWallet?: string | null;
  action: string;
  resource: string;
  status: AuditStatus;
  requestId?: string | null;
  ipHash?: string | null;
  createdAt: string;
}

const auditEvents: AuditEvent[] = [];

export function hashIp(ip?: string | null): string | null {
  if (!ip) return null;

  return crypto.createHash('sha256').update(ip).digest('hex');
}

export function redactAuditPayload<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const blocked = new Set(['password', 'token', 'secret', 'transaction', 'signedEnvelopeXdr']);

  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !blocked.has(key)),
  ) as Partial<T>;
}

export async function appendAuditEvent(event: Omit<AuditEvent, 'createdAt'>): Promise<AuditEvent> {
  const row: AuditEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };

  auditEvents.push(row);
  return row;
}

export function getAuditEvents(): AuditEvent[] {
  return [...auditEvents];
}

export function clearAuditEventsForTests(): void {
  auditEvents.length = 0;
}