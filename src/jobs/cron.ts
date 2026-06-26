import type { CronEntry } from "@/lib/jobs/scheduler";

interface RepeatableJob {
  name: string;
}

interface QueueLike {
  getRepeatableJobs(): Promise<RepeatableJob[]>;
  add(
    name: string,
    data: Record<string, unknown>,
    options: Record<string, unknown>,
  ): Promise<unknown>;
  close?(): Promise<void>;
}

type QueueConstructor = new (
  name: string,
  options?: Record<string, unknown>,
) => QueueLike;

async function loadQueueConstructor(): Promise<QueueConstructor> {
  const bullmq = await import("bullmq");
  return bullmq.Queue as QueueConstructor;
}

async function registerRepeatableJob(
  queueName: string,
  jobName: string,
  cron: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const Queue = await loadQueueConstructor();
  const queue = new Queue(queueName, {
    connection: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {},
  });

  try {
    const existing = await queue.getRepeatableJobs();
    if (existing.some((job) => job.name === jobName)) return;

    await queue.add(jobName, data, {
      repeat: { pattern: cron },
      removeOnComplete: true,
      removeOnFail: true,
    });
  } finally {
    await queue.close?.();
  }
}

export const cronEntries: CronEntry[] = [
  {
    id: "retention",
    name: "daily-retention",
    cron: "0 2 * * *",
    description:
      "Prune audit events, sessions, and stale position snapshots beyond retention windows.",
    schedule: () =>
      registerRepeatableJob("retention-job", "daily-retention", "0 2 * * *"),
  },
  {
    id: "snapshot",
    name: "daily-snapshot",
    cron: "0 0 * * *",
    description: "Capture daily position snapshots for tracked wallets.",
    schedule: () =>
      registerRepeatableJob("snapshot-job", "daily-snapshot", "0 0 * * *", {
        timestamp: Date.now(),
      }),
  },
  {
    id: "indexer-health-check",
    name: "indexer-health-check",
    cron: "*/5 * * * *",
    description:
      "Verify indexer progress and upstream Horizon health every five minutes.",
    schedule: () =>
      registerRepeatableJob(
        "indexer-health-check-job",
        "indexer-health-check",
        "*/5 * * * *",
      ),
  },
];

export default cronEntries;
