import { vi } from 'vitest';
vi.mock('server-only', () => ({}));

const notificationsStore = new Map<string, any[]>();
vi.mock('@/lib/notifications/repository', () => {
  const seedUser = (userId: string) => {
    notificationsStore.set(userId, [
      { id: 'notif-3', userId, title: 'Interest Earned', message: '...', read: true, createdAt: new Date().toISOString(), type: 'info' },
      { id: 'notif-2', userId, title: 'Loan Payment Due', message: '...', read: false, createdAt: new Date().toISOString(), type: 'warning' },
      { id: 'notif-1', userId, title: 'Deposit Confirmed', message: '...', read: false, createdAt: new Date().toISOString(), type: 'success' }
    ]);
  };
  return {
    getNotifications: vi.fn((userId: string) => {
      if (!notificationsStore.has(userId)) {
        seedUser(userId);
      }
      return notificationsStore.get(userId) || [];
    }),
    addNotification: vi.fn((userId: string, n: any) => {
      if (!notificationsStore.has(userId)) {
        seedUser(userId);
      }
      const list = notificationsStore.get(userId) || [];
      const newNotif = {
        ...n,
        userId,
        createdAt: new Date().toISOString()
      };
      list.unshift(newNotif);
      notificationsStore.set(userId, list);
      return newNotif;
    }),
    removeNotificationsByUserId: vi.fn((userId: string) => {
      const list = notificationsStore.get(userId) || [];
      notificationsStore.set(userId, []);
      return list.length;
    }),
    clearStore: vi.fn(() => {
      notificationsStore.clear();
    }),
  };
});

import { NextRequest } from 'next/server';
import { GET as ChallengeGET } from '@/app/api/account/delete/challenge/route';
import { DELETE as DeleteDELETE } from '@/app/api/account/delete/route';
import { signToken } from '@/lib/auth';
import { profileRepository } from '@/lib/account/repository';
import { getNotifications, removeNotificationsByUserId, clearStore } from '@/lib/notifications/repository';
import { getAuditEvents, clearAuditLog, emitAuditEvent } from '@/lib/audit/events';
import { getJobsByUserId, clearJobQueue, enqueueCleanupJob, processJob, getQueueStats } from '@/lib/queue/cleanup-queue';
import { clearChallengeStore, getChallengeCount } from '@/lib/account/challenge-store';
import { deleteAccount } from '@/lib/account/delete';

const USER = { id: 'user-delete-test-1', email: 'delete@example.com', name: 'Delete Test' };

function makeRequest(
  method: 'GET' | 'DELETE',
  url: string,
  opts: { token?: string; body?: unknown } = {}
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  return new NextRequest(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function validToken(user = USER) {
  return signToken(user);
}

beforeEach(() => {
  clearAuditLog();
  clearJobQueue();
  clearChallengeStore();
  clearStore();
});

describe('GET /api/account/delete/challenge', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await ChallengeGET(makeRequest('GET', 'http://localhost/api/account/delete/challenge'));
    expect(res.status).toBe(401);
  });

  test('returns 401 for invalid token', async () => {
    const res = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token: 'bad-token' })
    );
    expect(res.status).toBe(401);
  });

  test('returns challenge for authenticated user', async () => {
    const token = validToken();
    const res = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.challenge).toBeDefined();
    expect(json.challenge.length).toBe(64);
    expect(json.expiresAt).toBeDefined();
    expect(json.message).toContain('Sign this challenge');
  });

  test('challenge is unique per request', async () => {
    const token = validToken();
    const res1 = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const res2 = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );

    const j1 = await res1.json();
    const j2 = await res2.json();
    expect(j1.challenge).not.toBe(j2.challenge);
  });

  test('emits audit event for challenge issuance', async () => {
    const token = validToken();
    await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );

    const events = getAuditEvents({ userId: USER.id, type: 'auth.challenge.issued' });
    expect(events.length).toBe(1);
    expect(events[0].userId).toBe(USER.id);
  });
});

describe('DELETE /api/account/delete', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', { body: { challenge: 'test' } })
    );
    expect(res.status).toBe(401);
  });

  test('returns 401 for invalid token', async () => {
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token: 'bad-token',
        body: { challenge: 'test' },
      })
    );
    expect(res.status).toBe(401);
  });

  test('returns 400 when challenge is missing', async () => {
    const token = validToken();
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', { token, body: {} })
    );
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('Missing deletion challenge');
  });

  test('returns 400 for malformed JSON body', async () => {
    const token = validToken();
    const req = new NextRequest('http://localhost/api/account/delete', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{ invalid json',
    });
    const res = await DeleteDELETE(req);
    expect(res.status).toBe(400);
  });

  test('returns 401 for invalid challenge', async () => {
    const token = validToken();
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge: 'nonexistent-challenge' },
      })
    );
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Invalid or expired');
  });

  test('returns 401 when challenge belongs to different user', async () => {
    const otherUser = { id: 'other-user', email: 'other@example.com' };

    const challengeToken = validToken(otherUser);
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token: challengeToken })
    );
    const { challenge } = await challengeRes.json();

    const deleteToken = validToken(USER);
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token: deleteToken,
        body: { challenge },
      })
    );
    expect(res.status).toBe(401);
  });

  test('successfully deletes account with valid challenge', async () => {
    await profileRepository.upsert(USER.id, {
      displayName: 'ToDelete',
      bio: 'My bio',
      website: 'https://todelete.io',
      timezone: 'America/New_York',
    });

    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const { challenge } = await challengeRes.json();

    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.message).toBe('Account deletion initiated');
    expect(json.anonymizedAt).toBeDefined();
    expect(json.notificationsRemoved).toBe(0);
    expect(json.cleanupJobsEnqueued).toBe(3);
  });

  test('anonymizes profile fields after deletion', async () => {
    await profileRepository.upsert(USER.id, {
      displayName: 'ToDelete',
      bio: 'My bio',
      website: 'https://todelete.io',
      timezone: 'America/New_York',
    });

    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const { challenge } = await challengeRes.json();

    await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );

    const profile = await profileRepository.getByUserId(USER.id);
    expect(profile).not.toBeNull();
    expect(profile!.displayName).toBe('[deleted]');
    expect(profile!.bio).toBe('');
    expect(profile!.website).toBe('');
    expect(profile!.timezone).toBe('UTC');
  });

  test('removes user notifications after deletion', async () => {
    getNotifications(USER.id);
    const beforeCount = getNotifications(USER.id).length;
    expect(beforeCount).toBeGreaterThan(0);

    await profileRepository.upsert(USER.id, {
      displayName: 'ToDelete',
      bio: '',
      website: '',
      timezone: 'UTC',
    });

    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const { challenge } = await challengeRes.json();

    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );
    const json = await res.json();
    expect(json.notificationsRemoved).toBe(beforeCount);

    const afterNotifications = getNotifications(USER.id);
    expect(afterNotifications.length).toBe(0);
  });

  test('enqueues cleanup jobs after deletion', async () => {
    await profileRepository.upsert(USER.id, {
      displayName: 'ToDelete',
      bio: '',
      website: '',
      timezone: 'UTC',
    });

    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const { challenge } = await challengeRes.json();

    await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );

    const jobs = getJobsByUserId(USER.id);
    expect(jobs.length).toBe(3);

    const jobTypes = jobs.map((j) => j.type);
    expect(jobTypes).toContain('anonymize-backups');
    expect(jobTypes).toContain('remove-derived-data');
    expect(jobTypes).toContain('clear-cache-entries');

    jobs.forEach((job) => {
      expect(job.status).toBe('pending');
      expect(job.userId).toBe(USER.id);
      expect(job.scheduledFor).toBeDefined();
    });
  });

  test('emits account.deleted audit event', async () => {
    await profileRepository.upsert(USER.id, {
      displayName: 'ToDelete',
      bio: '',
      website: '',
      timezone: 'UTC',
    });

    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const { challenge } = await challengeRes.json();

    await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );

    const deletedEvents = getAuditEvents({ userId: USER.id, type: 'account.deleted' });
    expect(deletedEvents.length).toBe(1);
    expect(deletedEvents[0].metadata.anonymizedFields).toContain('displayName');
    expect(deletedEvents[0].metadata.cleanupJobs).toHaveLength(3);
    expect(deletedEvents[0].metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('emits sessions.revoked audit event', async () => {
    await profileRepository.upsert(USER.id, {
      displayName: 'ToDelete',
      bio: '',
      website: '',
      timezone: 'UTC',
    });

    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const { challenge } = await challengeRes.json();

    await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );

    const revokedEvents = getAuditEvents({ userId: USER.id, type: 'sessions.revoked' });
    expect(revokedEvents.length).toBe(1);
    expect(revokedEvents[0].metadata.reason).toBe('account_deletion');
  });

  test('returns 500 when no profile exists for user', async () => {
    const noProfileUser = { id: 'no-profile-user', email: 'noprofile@example.com' };

    const token = validToken(noProfileUser);
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const { challenge } = await challengeRes.json();

    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toContain('No profile found');
  });

  test('challenge can only be used once', async () => {
    await profileRepository.upsert(USER.id, {
      displayName: 'ToDelete',
      bio: '',
      website: '',
      timezone: 'UTC',
    });

    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token })
    );
    const { challenge } = await challengeRes.json();

    const res1 = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );
    expect(res1.status).toBe(200);

    const res2 = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      })
    );
    expect(res2.status).toBe(401);
  });
});

describe('lib/account/challenge-store', () => {
  test('createDeletionChallenge returns a challenge', async () => {
    const { createDeletionChallenge } = await import('@/lib/account/challenge-store');
    const result = createDeletionChallenge('test-user');
    expect(result.challenge).toBeDefined();
    expect(result.userId).toBe('test-user');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(result.createdAt.getTime());
  });

  test('verifyDeletionChallenge returns true for valid challenge', async () => {
    const { createDeletionChallenge, verifyDeletionChallenge } = await import('@/lib/account/challenge-store');
    const { challenge, userId } = createDeletionChallenge('verify-user');
    expect(verifyDeletionChallenge(challenge, userId)).toBe(true);
  });

  test('verifyDeletionChallenge returns false for wrong user', async () => {
    const { createDeletionChallenge, verifyDeletionChallenge } = await import('@/lib/account/challenge-store');
    const { challenge } = createDeletionChallenge('user-a');
    expect(verifyDeletionChallenge(challenge, 'user-b')).toBe(false);
  });

  test('verifyDeletionChallenge returns false for nonexistent challenge', async () => {
    const { verifyDeletionChallenge } = await import('@/lib/account/challenge-store');
    expect(verifyDeletionChallenge('nonexistent', 'any-user')).toBe(false);
  });

  test('clearChallengeStore removes all challenges', async () => {
    const { createDeletionChallenge, clearChallengeStore, getChallengeCount } = await import('@/lib/account/challenge-store');
    createDeletionChallenge('user-1');
    createDeletionChallenge('user-2');
    expect(getChallengeCount()).toBe(2);

    clearChallengeStore();
    expect(getChallengeCount()).toBe(0);
  });
});

describe('lib/account/repository - anonymizeByUserId', () => {
  test('returns false for unknown user', async () => {
    const result = await profileRepository.anonymizeByUserId('unknown-user');
    expect(result).toBe(false);
  });

  test('anonymizes all PII fields', async () => {
    await profileRepository.upsert('anon-user', {
      displayName: 'Secret Name',
      bio: 'Secret bio',
      website: 'https://secret.io',
      timezone: 'Europe/Paris',
    });

    const result = await profileRepository.anonymizeByUserId('anon-user');
    expect(result).toBe(true);

    const profile = await profileRepository.getByUserId('anon-user');
    expect(profile!.displayName).toBe('[deleted]');
    expect(profile!.bio).toBe('');
    expect(profile!.website).toBe('');
    expect(profile!.timezone).toBe('UTC');
  });

  test('preserves userId after anonymization', async () => {
    await profileRepository.upsert('preserve-user', {
      displayName: 'Name',
      bio: '',
      website: '',
      timezone: 'UTC',
    });

    await profileRepository.anonymizeByUserId('preserve-user');
    const profile = await profileRepository.getByUserId('preserve-user');
    expect(profile!.userId).toBe('preserve-user');
  });
});

describe('lib/notifications/repository - removeNotificationsByUserId', () => {
  test('returns 0 for user with no notifications', () => {
    const count = removeNotificationsByUserId('no-notifs-user');
    expect(count).toBe(0);
  });

  test('removes all notifications and returns count', () => {
    const notifs = getNotifications('notif-user');
    const initialCount = notifs.length;

    const removed = removeNotificationsByUserId('notif-user');
    expect(removed).toBe(initialCount);

    const remaining = getNotifications('notif-user');
    expect(remaining.length).toBe(0);
  });
});

describe('lib/audit/events', () => {
  test('emitAuditEvent creates and stores an event', () => {
    const event = emitAuditEvent('account.deleted', 'audit-user', { reason: 'test' });
    expect(event.id).toBeDefined();
    expect(event.type).toBe('account.deleted');
    expect(event.userId).toBe('audit-user');
    expect(event.timestamp).toBeDefined();
    expect(event.metadata.reason).toBe('test');

    const events = getAuditEvents({ userId: 'audit-user' });
    expect(events.some((e: any) => e.id === event.id)).toBe(true);
  });

  test('getAuditEvents filters by type', () => {
    clearAuditLog();
    emitAuditEvent('account.deleted', 'filter-user');
    emitAuditEvent('sessions.revoked', 'filter-user');

    const deleted = getAuditEvents({ userId: 'filter-user', type: 'account.deleted' });
    expect(deleted.length).toBe(1);
    expect(deleted[0].type).toBe('account.deleted');
  });

  test('getAuditEvents filters by since timestamp', () => {
    clearAuditLog();

    const past = new Date(Date.now() - 10000).toISOString();
    emitAuditEvent('account.deleted', 'time-user');

    const events = getAuditEvents({ userId: 'time-user', since: past });
    expect(events.length).toBe(1);

    const future = new Date(Date.now() + 10000).toISOString();
    const futureEvents = getAuditEvents({ userId: 'time-user', since: future });
    expect(futureEvents.length).toBe(0);
  });

  test('clearAuditLog removes all events', () => {
    clearAuditLog();
    emitAuditEvent('account.deleted', 'clear-user');
    expect(getAuditEvents({ userId: 'clear-user' }).length).toBeGreaterThan(0);

    clearAuditLog();
    expect(getAuditEvents({ userId: 'clear-user' }).length).toBe(0);
  });
});

describe('lib/queue/cleanup-queue', () => {
  test('enqueueCleanupJob creates a pending job', () => {
    clearJobQueue();
    const job = enqueueCleanupJob('remove-derived-data', 'queue-user');
    expect(job.id).toBeDefined();
    expect(job.status).toBe('pending');
    expect(job.userId).toBe('queue-user');
    expect(job.scheduledFor).toBeDefined();

    const jobs = getJobsByUserId('queue-user');
    expect(jobs.length).toBe(1);
  });

  test('different job types have different retention periods', () => {
    clearJobQueue();

    const cacheJob = enqueueCleanupJob('clear-cache-entries', 'retention-user');
    const auditJob = enqueueCleanupJob('purge-audit-logs', 'retention-user');

    const cacheScheduled = new Date(cacheJob.scheduledFor).getTime();
    const auditScheduled = new Date(auditJob.scheduledFor).getTime();
    expect(auditScheduled).toBeGreaterThan(cacheScheduled);
  });

  test('processJob marks job as completed', () => {
    clearJobQueue();
    const job = enqueueCleanupJob('clear-cache-entries', 'process-user');

    const result = processJob(job.id);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('completed');
    expect(result!.processedAt).toBeDefined();
  });

  test('processJob marks job as failed with error', () => {
    clearJobQueue();
    const job = enqueueCleanupJob('clear-cache-entries', 'fail-user');

    const result = processJob(job.id, 'Something went wrong');
    expect(result!.status).toBe('failed');
    expect(result!.error).toBe('Something went wrong');
  });

  test('processJob returns null for nonexistent job', () => {
    expect(processJob('nonexistent')).toBeNull();
  });

  test('getQueueStats returns correct counts', () => {
    clearJobQueue();

    const job1 = enqueueCleanupJob('clear-cache-entries', 'stats-user');
    const job2 = enqueueCleanupJob('remove-derived-data', 'stats-user');
    processJob(job1.id);
    processJob(job2.id, 'error');

    const stats = getQueueStats();
    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.pending).toBe(0);
  });

  test('clearJobQueue removes all jobs', () => {
    clearJobQueue();
    enqueueCleanupJob('clear-cache-entries', 'clear-queue-user');
    expect(getQueueStats().total).toBeGreaterThan(0);

    clearJobQueue();
    expect(getQueueStats().total).toBe(0);
  });
});

describe('lib/account/delete - deleteAccount', () => {
  test('throws when no profile exists', async () => {
    await expect(deleteAccount('nonexistent-delete-user')).rejects.toThrow('No profile found');
  });

  test('returns successful deletion result', async () => {
    await profileRepository.upsert('success-user', {
      displayName: 'Success',
      bio: '',
      website: '',
      timezone: 'UTC',
    });

    const result = await deleteAccount('success-user');
    expect(result.success).toBe(true);
    expect(result.userId).toBe('success-user');
    expect(result.anonymizedAt).toBeDefined();
    expect(result.cleanupJobsEnqueued.length).toBe(3);
    expect(result.auditEventId).toBeDefined();
  });
});
