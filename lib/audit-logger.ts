import { outboxEvents } from './db/schema';
import crypto from 'crypto';

export interface AuditLogPayload {
  userId: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
}

export const auditLogger = {
  /**
   * Writes an audit log event into the outbox events table.
   * This runs synchronously inside a Drizzle better-sqlite3 transaction.
   */
  log(tx: any, userId: string, action: string, details: Record<string, any>) {
    const payload: AuditLogPayload = {
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    
    tx.insert(outboxEvents).values({
      id: crypto.randomUUID(),
      type: 'audit',
      payload: JSON.stringify(payload),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
    }).run();
  }
};
