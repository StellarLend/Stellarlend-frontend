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

  constructor(
    private readonly manager: FakeAdvisoryLockManager,
    private readonly onRelease: () => void,
  ) {}

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
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
    if (this.released) return;
    this.released = true;
    this.manager.release(this);
    this.onRelease();
  }

  disconnect(): void {
    if (this.released) return;
    this.released = true;
    this.manager.release(this);
    this.onRelease();
  }
}

function createFakePool(manager: FakeAdvisoryLockManager, maxConnections = Number.POSITIVE_INFINITY) {
  const clients: FakeClient[] = [];
  const waiting: Array<(client: FakeClient) => void> = [];
  let activeClients = 0;

  const onRelease = (): void => {
    activeClients -= 1;
    if (waiting.length > 0) {
      const resolve = waiting.shift()!;
      activeClients += 1;
      const client = new FakeClient(manager, onRelease);
      clients.push(client);
      resolve(client);
    }
  };

  return {
    clients,
    pool: {
      connect: vi.fn(async () => {
        if (activeClients < maxConnections) {
          activeClients += 1;
          const client = new FakeClient(manager, onRelease);
          clients.push(client);
          return client;
        }

        return new Promise<FakeClient>((resolve) => {
          waiting.push(resolve);
        });
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

  it("lets a standby process acquire leadership after a crashed leader frees the only pool connection", async () => {
    const manager = new FakeAdvisoryLockManager();
    const fake = createFakePool(manager, 1);
    const leaderEntries = createEntries();
    const standbyEntries = createEntries();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const leader = new CronScheduler({
      pool: fake.pool,
      entries: leaderEntries,
      logger,
      electionIntervalMs: 60_000,
    });
    await leader.start();

    const standby = new CronScheduler({
      pool: fake.pool,
      entries: standbyEntries,
      logger,
      electionIntervalMs: 60_000,
    });

    const standbyPromise = standby.tryBecomeLeader();
    await Promise.resolve();

    expect(fake.pool.connect).toHaveBeenCalledTimes(2);
    expect(fake.clients[0].released).toBe(false);

    fake.clients[0].disconnect();

    await expect(standbyPromise).resolves.toBe(true);
    expect(manager.holder).not.toBe(fake.clients[0]);
    expect(standby.isLeader).toBe(true);
    standbyEntries.forEach((entry) =>
      expect(entry.schedule).toHaveBeenCalledTimes(1),
    );

    await standby.stop();
    expect(metrics.collect()).toContain("scheduler_is_leader 0");
  });
});
