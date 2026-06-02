import type { Pool, PoolClient } from "pg";
import pool from "@/lib/db/pool";
import { metrics } from "@/lib/metrics/registry";

export interface CronEntry {
  id: string;
  name: string;
  cron: string;
  description: string;
  schedule: () => Promise<void>;
}

export interface SchedulerOptions {
  pool?: Pick<Pool, "connect">;
  entries: CronEntry[];
  lockKey?: readonly [number, number];
  electionIntervalMs?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

const DEFAULT_LOCK_KEY = [0x53544c4c, 0x43524f4e] as const; // STLL / CRON
const DEFAULT_ELECTION_INTERVAL_MS = 30_000;

type SchedulerClient = Pick<PoolClient, "query" | "release">;

function getBooleanRow(
  result: { rows?: Array<Record<string, unknown>> },
  field: string,
): boolean {
  return result.rows?.[0]?.[field] === true;
}

export class CronScheduler {
  private readonly pool: Pick<Pool, "connect">;
  private readonly entries: CronEntry[];
  private readonly lockKey: readonly [number, number];
  private readonly electionIntervalMs: number;
  private readonly logger: Pick<Console, "info" | "warn" | "error">;
  private leaderClient: SchedulerClient | null = null;
  private electionTimer: NodeJS.Timeout | null = null;
  private stopped = true;
  private scheduledForCurrentTerm = false;

  constructor(options: SchedulerOptions) {
    this.pool = options.pool ?? pool;
    this.entries = options.entries;
    this.lockKey = options.lockKey ?? DEFAULT_LOCK_KEY;
    this.electionIntervalMs =
      options.electionIntervalMs ?? DEFAULT_ELECTION_INTERVAL_MS;
    this.logger = options.logger ?? console;
  }

  get isLeader(): boolean {
    return this.leaderClient !== null;
  }

  async start(): Promise<void> {
    if (!this.stopped) return;

    this.stopped = false;
    try {
      await this.tryBecomeLeader();
    } catch (error) {
      this.stopped = true;
      throw error;
    }
    this.electionTimer = setInterval(() => {
      void this.tryBecomeLeader();
    }, this.electionIntervalMs);
    this.electionTimer.unref?.();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.electionTimer) {
      clearInterval(this.electionTimer);
      this.electionTimer = null;
    }
    await this.releaseLeadership();
  }

  async tryBecomeLeader(): Promise<boolean> {
    if (this.stopped) return false;
    if (this.leaderClient) return true;

    const client = await this.pool.connect();
    const acquired = await this.acquireLock(client);

    if (!acquired) {
      client.release();
      metrics.setSchedulerIsLeader(0);
      return false;
    }

    this.leaderClient = client;
    this.scheduledForCurrentTerm = false;
    metrics.setSchedulerIsLeader(1);
    this.logger.info("[Scheduler] Acquired cron scheduler leadership");

    try {
      await this.scheduleEntriesOnce();
      return true;
    } catch (error) {
      this.logger.error(
        "[Scheduler] Failed to schedule cron entries after acquiring leadership",
        error,
      );
      await this.releaseLeadership();
      throw error;
    }
  }

  private async acquireLock(client: SchedulerClient): Promise<boolean> {
    const result = await client.query(
      "SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired",
      [this.lockKey[0], this.lockKey[1]],
    );
    return getBooleanRow(result, "acquired");
  }

  private async releaseLeadership(): Promise<void> {
    const client = this.leaderClient;
    if (!client) {
      metrics.setSchedulerIsLeader(0);
      return;
    }

    this.leaderClient = null;
    this.scheduledForCurrentTerm = false;

    try {
      await client.query(
        "SELECT pg_advisory_unlock($1::integer, $2::integer)",
        [this.lockKey[0], this.lockKey[1]],
      );
    } finally {
      client.release();
      metrics.setSchedulerIsLeader(0);
      this.logger.info("[Scheduler] Released cron scheduler leadership");
    }
  }

  private async scheduleEntriesOnce(): Promise<void> {
    if (this.scheduledForCurrentTerm) return;

    for (const entry of this.entries) {
      await entry.schedule();
      this.logger.info(
        `[Scheduler] Registered cron entry ${entry.id} (${entry.cron})`,
      );
    }

    this.scheduledForCurrentTerm = true;
  }
}

export function createCronScheduler(
  entries: CronEntry[],
  options: Omit<SchedulerOptions, "entries"> = {},
): CronScheduler {
  return new CronScheduler({ ...options, entries });
}
