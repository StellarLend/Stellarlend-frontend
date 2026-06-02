// src/jobs/retention.worker.ts
import { Worker, Queue, QueueScheduler, Job } from 'bullmq';
import pool from '../../lib/db/pool';
import {
  AUDIT_RETENTION_DAYS,
  SESSION_RETENTION_DAYS,
  SNAPSHOT_RETENTION_DAYS,
} from '../../lib/server-config';
import { recordDeletion } from '../../lib/metrics';

// Use environment variable to optionally dry-run
const DRY_RUN = process.env.RETENTION_DRY_RUN === 'true';

// Helper to delete stale rows for a given table and cutoff date
async function pruneTable(
  table: string,
  dateColumn: string,
  cutoff: Date
): Promise<number> {
  const client = await pool.connect();
  try {
    // Count rows to be deleted
    const countRes = await client.query(
      `SELECT COUNT(*) FROM ${table} WHERE ${dateColumn} < $1`,
      [cutoff]
    );
    const deleteCount = parseInt(countRes.rows[0].count, 10);
    if (deleteCount === 0) return 0;
    if (DRY_RUN) {
      console.log(`[Retention][DRY RUN] Would delete ${deleteCount} rows from ${table}`);
      return deleteCount;
    }
    // Delete in batches of 1000 to avoid long transactions
    let totalDeleted = 0;
    while (true) {
      const delRes = await client.query(
        `DELETE FROM ${table} WHERE ${dateColumn} < $1 LIMIT 1000 RETURNING *`,
        [cutoff]
      );
      const batchDeleted = delRes.rowCount;
      totalDeleted += batchDeleted;
      if (batchDeleted < 1000) break;
    }
    console.log(`[Retention] Deleted ${totalDeleted} rows from ${table}`);
    return totalDeleted;
  } finally {
    client.release();
  }
}

export async function runRetention(): Promise<void> {
  const now = new Date();
  const auditCutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const snapshotCutoff = new Date(now.getTime() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const auditDeleted = await pruneTable('audit_events', 'created_at', auditCutoff);
  recordDeletion('audit_events', auditDeleted);

  const sessionDeleted = await pruneTable('sessions', 'created_at', sessionCutoff);
  recordDeletion('sessions', sessionDeleted);

  const snapshotDeleted = await pruneTable('position_snapshots', 'created_at', snapshotCutoff);
  recordDeletion('position_snapshots', snapshotDeleted);
}

// Queue setup – a daily repeatable job
const queueName = 'retention-job';
const queue = new Queue(queueName, {
  connection: {
    // BullMQ will use default Redis connection env vars (REDIS_URL etc.)
  },
});
const scheduler = new QueueScheduler(queueName);

export const retentionWorker = new Worker(
  queueName,
  async (job: Job) => {
    await runRetention();
  },
  {
    connection: {
      // default connection
    },
  }
);

// Schedule the job on startup if not already scheduled
export async function scheduleRetentionJob(): Promise<void> {
  const existing = await queue.getRepeatableJobs();
  const already = existing.some((j) => j.name === 'daily-retention');
  if (!already) {
    await queue.add(
      'daily-retention',
      {},
      {
        repeat: { cron: '0 2 * * *' }, // every day at 02:00 UTC
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    console.log('[Retention] Daily retention job scheduled');
  }
}

scheduleRetentionJob().catch((e) => console.error('Failed to schedule retention job', e));
