import { describe, it, expect, beforeEach } from 'vitest';
import {
  emitAccountAuditEvent,
  appendTransactionAuditEvent,
  getAccountAuditEvents,
  getTransactionAuditEvents,
  getAllAuditEvents,
  clearAuditLog,
  DEFAULT_MAX_AUDIT_EVENTS,
  setMaxAuditEventsForTests,
  resetMaxAuditEventsForTests,
} from '@/lib/audit';

// ---------------------------------------------------------------------------
// Account audit events
// ---------------------------------------------------------------------------

describe('account audit events', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('creates and stores an account event', () => {
    const event = emitAccountAuditEvent('account.deleted', 'user-1', { reason: 'test' });
    expect(event.kind).toBe('account');
    expect(event.id).toBeDefined();
    expect(event.type).toBe('account.deleted');
    expect(event.userId).toBe('user-1');
    expect(event.metadata.reason).toBe('test');

    const events = getAccountAuditEvents({ userId: 'user-1' });
    expect(events.some((e) => e.id === event.id)).toBe(true);
  });

  it('filters by type', () => {
    clearAuditLog();
    emitAccountAuditEvent('account.deleted', 'u');
    emitAccountAuditEvent('sessions.revoked', 'u');

    const deleted = getAccountAuditEvents({ type: 'account.deleted' });
    expect(deleted.length).toBe(1);
    expect(deleted[0].type).toBe('account.deleted');
  });

  it('filters by since timestamp', () => {
    clearAuditLog();
    const past = new Date(Date.now() - 10_000).toISOString();
    emitAccountAuditEvent('account.deleted', 'time-u');

    expect(getAccountAuditEvents({ since: past }).length).toBe(1);

    const future = new Date(Date.now() + 10_000).toISOString();
    expect(getAccountAuditEvents({ since: future }).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Transaction audit events
// ---------------------------------------------------------------------------

describe('transaction audit events', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('creates and stores a transaction event', async () => {
    const event = await appendTransactionAuditEvent({
      actorWallet: 'wallet-abc',
      action: 'tx.submit',
      resource: 'soroban.transaction',
      status: 'success',
      requestId: 'req-1',
      ipHash: 'hash',
    });

    expect(event.kind).toBe('transaction');
    expect(event.action).toBe('tx.submit');
    expect(event.createdAt).toBeDefined();

    const events = getTransactionAuditEvents();
    expect(events.some((e) => e.action === 'tx.submit')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Eviction policy
// ---------------------------------------------------------------------------

describe('audit log eviction', () => {
  beforeEach(() => {
    clearAuditLog();
    resetMaxAuditEventsForTests();
  });

  afterEach(() => {
    resetMaxAuditEventsForTests();
  });

  it('drops the oldest entries once the cap is reached', () => {
    setMaxAuditEventsForTests(5);

    const first = emitAccountAuditEvent('account.deleted', 'evict-user', { seq: 1 });
    emitAccountAuditEvent('sessions.revoked', 'evict-user', { seq: 2 });
    emitAccountAuditEvent('account.deleted', 'evict-user', { seq: 3 });
    emitAccountAuditEvent('sessions.revoked', 'evict-user', { seq: 4 });
    emitAccountAuditEvent('account.deleted', 'evict-user', { seq: 5 });

    // Still at cap — no eviction yet
    expect(getAllAuditEvents().length).toBe(5);

    // Adding one more should evict the oldest
    emitAccountAuditEvent('sessions.revoked', 'evict-user', { seq: 6 });

    const remaining = getAllAuditEvents();
    expect(remaining.length).toBe(5);

    // The very first event should have been evicted
    const ids = remaining.map((e) => (e.kind === 'account' ? e.id : undefined));
    expect(ids).not.toContain(first.id);

    // The remaining events should be seq 2-6
    const seqs = remaining.map((e) =>
      e.kind === 'account' ? (e.metadata as any).seq : undefined,
    );
    expect(seqs).toEqual([2, 3, 4, 5, 6]);
  });

  it('drops oldest transaction events when cap is reached', async () => {
    setMaxAuditEventsForTests(3);

    await appendTransactionAuditEvent({ action: 'a1', resource: 'r', status: 'success' });
    await appendTransactionAuditEvent({ action: 'a2', resource: 'r', status: 'success' });
    await appendTransactionAuditEvent({ action: 'a3', resource: 'r', status: 'success' });
    await appendTransactionAuditEvent({ action: 'a4', resource: 'r', status: 'failure' });

    const txEvents = getTransactionAuditEvents();
    expect(txEvents.length).toBe(3);
    expect(txEvents[0].action).toBe('a2');
    expect(txEvents[1].action).toBe('a3');
    expect(txEvents[2].action).toBe('a4');
  });

  it('drops oldest mixed events (account + transaction) when cap is reached', async () => {
    setMaxAuditEventsForTests(4);

    emitAccountAuditEvent('account.deleted', 'u', { seq: 1 });
    await appendTransactionAuditEvent({ action: 'tx1', resource: 'r', status: 'success' });
    emitAccountAuditEvent('sessions.revoked', 'u', { seq: 2 });
    await appendTransactionAuditEvent({ action: 'tx2', resource: 'r', status: 'failure' });

    // At cap — no eviction yet
    expect(getAllAuditEvents().length).toBe(4);

    // This should evict the oldest (account.deleted seq 1)
    emitAccountAuditEvent('account.deleted', 'u', { seq: 3 });

    const remaining = getAllAuditEvents();
    expect(remaining.length).toBe(4);

    // The first account event (seq 1) should be gone
    const accountSeqs = remaining
      .filter((e) => e.kind === 'account')
      .map((e) => (e as any).metadata.seq);
    expect(accountSeqs).not.toContain(1);
    expect(accountSeqs).toContain(2);
    expect(accountSeqs).toContain(3);
  });

  it('respects the default cap', () => {
    // The default cap should be a reasonable value
    expect(DEFAULT_MAX_AUDIT_EVENTS).toBe(10_000);
  });
});
