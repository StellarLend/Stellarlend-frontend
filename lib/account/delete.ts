import { profileRepository } from '@/lib/account/repository';
import { removeNotificationsByUserId } from '@/lib/notifications/repository';
import { emitAuditEvent } from '@/lib/audit/events';
import { enqueueCleanupJob } from '@/lib/queue/cleanup-queue';
import { logger } from '@/lib/logger';

export interface AccountDeletionResult {
  success: boolean;
  userId: string;
  anonymizedAt: string;
  notificationsRemoved: number;
  cleanupJobsEnqueued: string[];
  auditEventId: string;
}

export async function deleteAccount(userId: string): Promise<AccountDeletionResult> {
  const startedAt = Date.now();

  const profile = await profileRepository.getByUserId(userId);
  if (!profile) {
    throw new Error(`No profile found for user ${userId}`);
  }

  const anonymized = await profileRepository.anonymizeByUserId(userId);
  if (!anonymized) {
    throw new Error(`Failed to anonymize profile for user ${userId}`);
  }

  const notificationsRemoved = removeNotificationsByUserId(userId);

  const cleanupJobs: string[] = [];

  const backupJob = enqueueCleanupJob('anonymize-backups', userId);
  cleanupJobs.push(backupJob.id);

  const derivedJob = enqueueCleanupJob('remove-derived-data', userId);
  cleanupJobs.push(derivedJob.id);

  const cacheJob = enqueueCleanupJob('clear-cache-entries', userId);
  cleanupJobs.push(cacheJob.id);

  emitAuditEvent('sessions.revoked', userId, {
    reason: 'account_deletion',
    notificationsRemoved,
  });

  const auditEvent = emitAuditEvent('account.deleted', userId, {
    anonymizedFields: ['displayName', 'bio', 'website', 'timezone'],
    notificationsRemoved,
    cleanupJobs,
    durationMs: Date.now() - startedAt,
  });

  logger.info('account deletion completed', '/lib/account/delete', {
    userId,
    anonymized,
    notificationsRemoved,
    cleanupJobs,
    auditEventId: auditEvent.id,
    durationMs: Date.now() - startedAt,
  });

  return {
    success: true,
    userId,
    anonymizedAt: new Date().toISOString(),
    notificationsRemoved,
    cleanupJobs,
    auditEventId: auditEvent.id,
  };
}
