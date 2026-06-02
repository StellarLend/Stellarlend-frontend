import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/pool", () => ({ default: { connect: vi.fn() } }));

import {
  CronScheduler,
  createCronScheduler,
  type CronEntry,
} from "./scheduler";
import { metrics } from "@/lib/metrics/registry";

type QueryResult = { rows: Array<Record<string, unknown>> };

class FakeAdvisoryLockManager {
  holder: FakeClient | null = null;

  tryAcquire(client: FakeClient): boolean {
    if (!this.holder) {
      this.holder = client;
      return true;
    }
    return this.holder === client;
  }

  release(client: FakeClient): void {
    if (this.holder === client) {
      this.holder = null;
    }
  }
}

class FakeClient {
  released = false;
  queries: string[] = [];

  constructor(private readonly manager: FakeAdvisoryLockManager) {}

  async query(sql: string): Promise<QueryResult> {
    this.queries.push(sql);
    if (sql.includes("pg_try_advisory_lock")) {
      return { rows: [{ acquired: this.manager.tryAcquire(this) }] };
    }
    if (
      sql.includes("pg_advisory_unlock") &&
      !sql.includes("pg_try_advisory_lock")
    ) {
      this.manager.release(this);
      return { rows: [{ pg_advisory_unlock: true }] };
    }
    return { rows: [] };
  }

  release(): void {
    this.released = true;
  }
}

function createFakePool(manager: FakeAdvisoryLockManager) {
  const clients: FakeClient[] = [];
  return {
    clients,
    pool: {
      connect: vi.fn(async () => {
        const client = new FakeClient(manager);
        clients.push(client);
        return client;
      }),
    },
  };
}

function createEntries() {
  return [
    {
      id: "retention",
      name: "daily-retention",
      cron: "0 2 * * *",
      description: "retention",
      schedule: vi.fn().mockResolvedValue(undefined),
    },
    {
      id: "snapshot",
      name: "daily-snapshot",
      cron: "0 0 * * *",
      description: "snapshot",
      schedule: vi.fn().mockResolvedValue(undefined),
    },
    {
      id: "indexer-health-check",
      name: "indexer-health-check",
      cron: "*/5 * * * *",
      description: "indexer health",
      schedule: vi.fn().mockResolvedValue(undefined),
    },
  ] satisfies CronEntry[];
}

describe("CronScheduler advisory-lock leader election", () => {
  beforeEach(() => {
    metrics.setSchedulerIsLeader(0);
  });

  it("allows only one simulated process to register cron entries", async () => {
    const manager = new FakeAdvisoryLockManager();
    const fake = createFakePool(manager);
    const firstEntries = createEntries();
    const secondEntries = createEntries();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const first = new CronScheduler({
      pool: fake.pool,
      entries: firstEntries,
      logger,
      electionIntervalMs: 60_000,
    });
    const second = new CronScheduler({
      pool: fake.pool,
      entries: secondEntries,
      logger,
      electionIntervalMs: 60_000,
    });

    await first.start();
    await second.start();

    expect(first.isLeader).toBe(true);
    expect(second.isLeader).toBe(false);
    firstEntries.forEach((entry) =>
      expect(entry.schedule).toHaveBeenCalledTimes(1),
    );
    secondEntries.forEach((entry) =>
      expect(entry.schedule).not.toHaveBeenCalled(),
    );
    expect(fake.clients[1].released).toBe(true);

    await first.stop();
    await second.stop();
  });

  it("is idempotent while running and releases leadership if cron registration fails", async () => {
    const manager = new FakeAdvisoryLockManager();
    const fake = createFakePool(manager);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const failingEntries = [
      {
        id: "retention",
        name: "daily-retention",
        cron: "0 2 * * *",
        description: "retention",
        schedule: vi.fn().mockRejectedValue(new Error("queue unavailable")),
      },
    ] satisfies CronEntry[];

    const scheduler = createCronScheduler(failingEntries, {
      pool: fake.pool,
      logger,
      electionIntervalMs: 60_000,
    });

    await expect(scheduler.start()).rejects.toThrow("queue unavailable");
    expect(scheduler.isLeader).toBe(false);
    expect(fake.clients[0].released).toBe(true);
    expect(metrics.collect()).toContain("scheduler_is_leader 0");

    const healthyEntries = createEntries();
    const healthyScheduler = new CronScheduler({
      pool: fake.pool,
      entries: healthyEntries,
      logger,
      electionIntervalMs: 60_000,
    });
    await healthyScheduler.start();
    await expect(healthyScheduler.start()).resolves.toBeUndefined();
    await expect(healthyScheduler.tryBecomeLeader()).resolves.toBe(true);
    healthyEntries.forEach((entry) =>
      expect(entry.schedule).toHaveBeenCalledTimes(1),
    );
    await healthyScheduler.stop();
  });

  it("lets a standby process recover scheduling after the leader releases the advisory lock", async () => {
    const manager = new FakeAdvisoryLockManager();
    const fake = createFakePool(manager);
    const leaderEntries = createEntries();
    const standbyEntries = createEntries();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const leader = new CronScheduler({
      pool: fake.pool,
      entries: leaderEntries,
      logger,
      electionIntervalMs: 60_000,
    });
    const standby = new CronScheduler({
      pool: fake.pool,
      entries: standbyEntries,
      logger,
      electionIntervalMs: 60_000,
    });

    await leader.start();
    await standby.start();

    await leader.stop();
    await expect(standby.tryBecomeLeader()).resolves.toBe(true);

    expect(standby.isLeader).toBe(true);
    standbyEntries.forEach((entry) =>
      expect(entry.schedule).toHaveBeenCalledTimes(1),
    );
    expect(metrics.collect()).toContain("scheduler_is_leader 1");

    await standby.stop();
    expect(metrics.collect()).toContain("scheduler_is_leader 0");
  });
});
