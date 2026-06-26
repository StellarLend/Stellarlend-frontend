import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock BullMQ before importing the module under test to run tests in isolation without Redis
vi.mock('bullmq', () => {
  class MockQueue {
    name: string;
    static instances: Record<string, MockQueue> = {};
    jobs: any[] = [];
    
    constructor(name: string) {
      this.name = name;
      MockQueue.instances[name] = this;
    }
    
    async add(name: string, data: any, opts: any) {
      const job = { id: opts.jobId || 'job-' + Math.random().toString(), name, data, opts };
      this.jobs.push(job);
      return job;
    }
  }
  
  class MockWorker {
    name: string;
    handler: (job: any) => Promise<any>;
    static instances: Record<string, MockWorker> = {};
    
    constructor(name: string, handler: (job: any) => Promise<any>) {
      this.name = name;
      this.handler = handler;
      MockWorker.instances[name] = this;
    }
    
    async close() {}
  }
  
  return {
    Queue: MockQueue,
    Worker: MockWorker,
  };
});

import { Queue, Worker } from 'bullmq';
import { db } from '@/lib/db/client';
import { profiles, outboxEvents } from '@/lib/db/schema';
import { profileRepository, ProfileRecord } from '@/lib/account/repository';
import { getNotifications, clearStore as clearNotificationStore } from '@/lib/notifications/repository';
import {
  processOutbox,
  startDispatcher,
  stopDispatcher,
} from '@/src/jobs/outbox-dispatcher.worker';
import { eq } from 'drizzle-orm';

describe('Transactional Outbox', () => {
  beforeEach(async () => {
    // Clear in-memory SQLite tables before each test
    await db.delete(profiles);
    await db.delete(outboxEvents);
    clearNotificationStore();
    
    // Reset mock queues
    const qInstances = (Queue as any).instances;
    if (qInstances) {
      for (const key in qInstances) {
        qInstances[key].jobs = [];
      }
    }
  });

  it('should atomically save profile and outbox events in a transaction', async () => {
    const userId = 'user-test-outbox';
    const profileData = {
      displayName: 'Alice Outbox',
      bio: 'Lending enthusiast',
      website: 'https://alice.outbox.dev',
      timezone: 'UTC',
    };

    // Run the transaction
    const record = db.transaction((tx) => {
      // 1. Update the profile
      const updatedRecord = profileRepository.upsert(userId, profileData, tx) as ProfileRecord;

      // 2. Queue in-app notification event in the outbox
      tx.insert(outboxEvents).values({
        id: 'evt-notif-1',
        type: 'notification',
        payload: JSON.stringify({
          userId,
          title: 'Profile Updated',
          message: 'Your profile has been successfully updated.',
          type: 'success',
        }),
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(),
      }).run();

      // 3. Queue audit log event in the outbox
      tx.insert(outboxEvents).values({
        id: 'evt-audit-1',
        type: 'audit',
        payload: JSON.stringify({
          userId,
          action: 'profile_update',
          details: profileData,
          timestamp: new Date().toISOString(),
        }),
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(),
      }).run();

      return updatedRecord;
    });

    expect(record.displayName).toBe('Alice Outbox');

    // Verify database has the profile
    const dbProfile = await profileRepository.getByUserId(userId);
    expect(dbProfile).not.toBeNull();
    expect(dbProfile?.displayName).toBe('Alice Outbox');

    // Verify outbox events are written
    const events = await db.select().from(outboxEvents);
    expect(events).toHaveLength(2);
    expect(events.map(e => e.status)).toEqual(['PENDING', 'PENDING']);
    expect(events.map(e => e.type).sort()).toEqual(['audit', 'notification'].sort());
  });

  it('should dispatch pending outbox events to BullMQ queues and transition status to COMPLETED', async () => {
    const userId = 'user-dispatch-test';
    
    // Insert pending outbox event
    await db.insert(outboxEvents).values({
      id: 'evt-to-dispatch',
      type: 'notification',
      payload: JSON.stringify({
        userId,
        title: 'Dispatch Test',
        message: 'This event will be dispatched.',
        type: 'info',
      }),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
    });

    // Run outbox dispatcher
    await processOutbox();

    // Verify the outbox status in DB changed to COMPLETED
    const [dbEvent] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, 'evt-to-dispatch'));
    
    expect(dbEvent.status).toBe('COMPLETED');
    expect(dbEvent.processedAt).toBeInstanceOf(Date);

    // Verify it was enqueued in BullMQ
    const notifQueue = (Queue as any).instances['notification-queue'];
    expect(notifQueue).toBeDefined();
    expect(notifQueue.jobs).toHaveLength(1);
    expect(notifQueue.jobs[0].id).toBe('evt-to-dispatch');
    expect(notifQueue.jobs[0].data.userId).toBe(userId);
  });

  it('should dispatch pending audit outbox events and handle unknown event types', async () => {
    const userId = 'user-dispatch-audit-test';

    // 1. Insert audit event
    await db.insert(outboxEvents).values({
      id: 'evt-audit-to-dispatch',
      type: 'audit',
      payload: JSON.stringify({
        userId,
        action: 'profile_update',
        details: { displayName: 'Bob' },
        timestamp: new Date().toISOString(),
      }),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
    });

    // 2. Insert unknown type event
    await db.insert(outboxEvents).values({
      id: 'evt-unknown-to-dispatch',
      type: 'unknown_type',
      payload: JSON.stringify({}),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
    });

    // Run outbox dispatcher
    await processOutbox();

    // Verify audit event completed
    const [dbAuditEvent] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, 'evt-audit-to-dispatch'));
    expect(dbAuditEvent.status).toBe('COMPLETED');

    // Verify audit event enqueued
    const auditQ = (Queue as any).instances['audit-queue'];
    expect(auditQ).toBeDefined();
    expect(auditQ.jobs).toHaveLength(1);
    expect(auditQ.jobs[0].id).toBe('evt-audit-to-dispatch');

    // Verify unknown type event failed
    const [dbUnknownEvent] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, 'evt-unknown-to-dispatch'));
    expect(dbUnknownEvent.status).toBe('FAILED');
    expect(dbUnknownEvent.lastError).toContain('Unknown event type');
  });

  it('should handle dispatch failure, transition status to FAILED, and increment attempts', async () => {
    const userId = 'user-fail-test';

    // Mock Queue.add to fail once
    const notifQueue = (Queue as any).instances['notification-queue'];
    const originalAdd = notifQueue.add;
    notifQueue.add = async () => {
      throw new Error('Redis connection lost');
    };

    // Insert pending outbox event
    await db.insert(outboxEvents).values({
      id: 'evt-to-fail',
      type: 'notification',
      payload: JSON.stringify({
        userId,
        title: 'Fail Test',
        message: 'This event will fail.',
        type: 'error',
      }),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
    });

    // Run outbox dispatcher
    await processOutbox();

    // Verify outbox status in DB is FAILED, attempts is 1, and error message is saved
    const [dbEvent] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, 'evt-to-fail'));

    expect(dbEvent.status).toBe('FAILED');
    expect(dbEvent.attempts).toBe(1);
    expect(dbEvent.lastError).toBe('Redis connection lost');

    // Restore original add function
    notifQueue.add = originalAdd;
  });

  it('should process jobs through the consumers (workers)', async () => {
    const userId = 'user-worker-test';
    
    // Get instances of mock worker
    const notifWorker = (Worker as any).instances['notification-queue'];
    expect(notifWorker).toBeDefined();

    // Simulate job processing
    const mockJob = {
      id: 'evt-job-1',
      data: {
        userId,
        title: 'Consumer Notification',
        message: 'Processed successfully.',
        type: 'success',
      },
    };

    await notifWorker.handler(mockJob);

    // Verify notification was written to user's notification list
    const notifications = getNotifications(userId);
    expect(notifications).toHaveLength(4); // 3 seeded + 1 new
    expect(notifications[0].title).toBe('Consumer Notification');
    expect(notifications[0].message).toBe('Processed successfully.');
  });

  it('should guarantee eventual delivery after worker crash / failure (at-least-once)', async () => {
    const userId = 'user-crash-recovery';
    const notifQueue = (Queue as any).instances['notification-queue'];
    const notifWorker = (Worker as any).instances['notification-queue'];

    // Insert pending outbox event
    await db.insert(outboxEvents).values({
      id: 'evt-crash-1',
      type: 'notification',
      payload: JSON.stringify({
        userId,
        title: 'Crash Recovery Test',
        message: 'Deliver me eventually.',
        type: 'success',
      }),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
    });

    // 1. Simulate worker crash during dispatch by throwing an error in Queue.add
    const originalAdd = notifQueue.add;
    notifQueue.add = async () => {
      throw new Error('Fatal: Dispatcher crashed');
    };

    // Run outbox dispatcher - will fail and mark as FAILED
    await processOutbox();

    // Verify it failed
    let [dbEvent] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, 'evt-crash-1'));
    expect(dbEvent.status).toBe('FAILED');
    expect(dbEvent.attempts).toBe(1);

    // Verify it was NOT enqueued in BullMQ yet
    expect(notifQueue.jobs).toHaveLength(0);

    // 2. Restart worker (restore Queue.add behavior)
    notifQueue.add = originalAdd;

    // Run outbox dispatcher again - should pick up the FAILED event and retry it successfully
    await processOutbox();

    // Verify status changed to COMPLETED
    [dbEvent] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, 'evt-crash-1'));
    expect(dbEvent.status).toBe('COMPLETED');

    // Verify enqueued in queue
    expect(notifQueue.jobs).toHaveLength(1);
    expect(notifQueue.jobs[0].id).toBe('evt-crash-1');

    // 3. Process the enqueued job using the worker
    await notifWorker.handler(notifQueue.jobs[0]);

    // Verify notification delivered eventually
    const notifications = getNotifications(userId);
    expect(notifications).toHaveLength(4);
    expect(notifications[0].title).toBe('Crash Recovery Test');
  });

  it('should run auditWorker successfully', async () => {
    const auditWorker = (Worker as any).instances['audit-queue'];
    expect(auditWorker).toBeDefined();

    const mockJob = {
      id: 'evt-audit-1',
      data: {
        userId: 'user-audit-test',
        action: 'profile_update',
        details: { displayName: 'Bob' },
        timestamp: new Date().toISOString(),
      },
    };

    await expect(auditWorker.handler(mockJob)).resolves.not.toThrow();
  });

  it('should start and stop the dispatcher interval', () => {
    startDispatcher(1000);
    // Double calling should be fine
    startDispatcher(1000);
    stopDispatcher();
    // Double calling should be fine
    stopDispatcher();
  });

  it('should catch and log errors in processOutbox', async () => {
    const originalTransaction = db.transaction;
    // Mock to throw
    (db as any).transaction = () => {
      throw new Error('Database transaction failed');
    };

    // Run outbox dispatcher - should not throw, but log the error
    await expect(processOutbox()).resolves.not.toThrow();

    // Restore
    (db as any).transaction = originalTransaction;
  });
});
