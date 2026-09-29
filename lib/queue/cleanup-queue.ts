import { logger } from '@/lib/logger';

export type CleanupJobType =
  | 'anonymize-backups'
  | 'purge-audit-logs'
  | 'remove-derived-data'
  | 'clear-cache-entries';

export type CleanupJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CleanupJob {
  id: string;
  type: CleanupJobType;
  userId: string;
  status: CleanupJobStatus;
  createdAt: string;
  processedAt?: string;
  error?: string;
  scheduledFor: string;
}

const jobQueue: CleanupJob[] = [];
let jobCounter = 0;

/**
 * Terminal (completed/failed) jobs are kept in the in-memory queue for this
 * duration after they are processed, then pruned. This bounds memory growth
 * in long-running processes — completed/failed jobs are no longer actionable
 * and only serve as short-lived diagnostics after their terminal status.
 */
const TERMINAL_JOB_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateJobId(): string {
  jobCounter += 1;
  return `cleanup-${Date.now()}-${jobCounter}`;
}

function getDefaultRetentionMs(type: CleanupJobType): number {
  switch (type) {
    case 'anonymize-backups':
      return 30 * 24 * 60 * 60 * 1000;
    case 'purge-audit-logs':
      return 90 * 24 * 60 * 60 * 1000;
    case 'remove-derived-data':
      return 7 * 24 * 60 * 60 * 1000;
    case 'clear-cache-entries':
      return 24 * 60 * 60 * 1000;
    default:
      return 30 * 24 * 60 * 60 * 1000;
  }
}

export function enqueueCleanupJob(
  type: CleanupJobType,
  userId: string,
  options?: { retentionMs?: number }
): CleanupJob {
  const retentionMs = options?.retentionMs ?? getDefaultRetentionMs(type);
  const scheduledFor = new Date(Date.now() + retentionMs).toISOString();

  const job: CleanupJob = {
    id: generateJobId(),
    type,
    userId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    scheduledFor,
  };

  jobQueue.push(job);

  logger.info(`cleanup job enqueued: ${type}`, '/lib/queue/cleanup-queue', {
    jobId: job.id,
    userId,
    scheduledFor,
    retentionMs,
  });

  return job;
}

export function getPendingJobs(): CleanupJob[] {
  const now = new Date();
  return jobQueue.filter(
    (j) => j.status === 'pending' && new Date(j.scheduledFor) <= now
  );
}

export function processJob(jobId: string, error?: string): CleanupJob | null {
  const job = jobQueue.find((j) => j.id === jobId);
  if (!job) return null;

  if (error) {
    job.status = 'failed';
    job.error = error;
  } else {
    job.status = 'completed';
  }
  job.processedAt = new Date().toISOString();

  return job;
}

export function getJobsByUserId(userId: string): CleanupJob[] {
  return jobQueue.filter((j) => j.userId === userId);
}

/**
 * Remove terminal (completed or failed) jobs whose `processedAt` is older
 * than `maxAgeMs` ago. Pending and processing jobs are never pruned here;
 * only terminal jobs age out, since they are no longer actionable.
 *
 * Defaults to `TERMINAL_JOB_RETENTION_MS` (24h) when no `maxAgeMs` is given.
 *
 * @returns The number of jobs removed.
 */
export function pruneTerminalJobs(
  maxAgeMs: number = TERMINAL_JOB_RETENTION_MS,
): number {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    throw new Error(
      `pruneTerminalJobs: maxAgeMs must be a finite, non-negative number, got ${maxAgeMs}`,
    );
  }

  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  for (let i = jobQueue.length - 1; i >= 0; i--) {
    const job = jobQueue[i];
    const isTerminal = job.status === 'completed' || job.status === 'failed';
    if (!isTerminal || !job.processedAt) continue;

    if (new Date(job.processedAt).getTime() < cutoff) {
      jobQueue.splice(i, 1);
      removed += 1;
    }
  }

  if (removed > 0) {
    logger.info(
      `pruned ${removed} terminal cleanup job(s) older than ${maxAgeMs}ms`,
      '/lib/queue/cleanup-queue',
    );
  }

  return removed;
}

export function clearJobQueue(): void {
  jobQueue.length = 0;
  jobCounter = 0;
}

export async function startQueueProcessor(): Promise<void> {
  pruneTerminalJobs();

  const pending = getPendingJobs();
  for (const job of pending) {
    try {
      processJob(job.id);
      logger.info(`cleanup job completed: ${job.type}`, '/lib/queue/cleanup-queue', {
        jobId: job.id,
        userId: job.userId,
      });
    } catch (err) {
      processJob(job.id, err instanceof Error ? err.message : String(err));
      logger.error(`cleanup job failed: ${job.type}`, '/lib/queue/cleanup-queue', {
        jobId: job.id,
        userId: job.userId,
        error: err,
      });
    }
  }
}

export function getQueueStats(): {
  total: number;
  pending: number;
  completed: number;
  failed: number;
} {
  return {
    total: jobQueue.length,
    pending: jobQueue.filter((j) => j.status === 'pending').length,
    completed: jobQueue.filter((j) => j.status === 'completed').length,
    failed: jobQueue.filter((j) => j.status === 'failed').length,
  };
}
