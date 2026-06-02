import { beforeEach, describe, expect, it, vi } from "vitest";

const queueInstances: Array<{
  name: string;
  options: Record<string, unknown> | undefined;
  getRepeatableJobs: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("bullmq", () => ({
  Queue: vi
    .fn()
    .mockImplementation((name: string, options?: Record<string, unknown>) => {
      const instance = {
        name,
        options,
        getRepeatableJobs: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue({}),
        close: vi.fn().mockResolvedValue(undefined),
      };
      queueInstances.push(instance);
      return instance;
    }),
}));

describe("cron registry", () => {
  beforeEach(() => {
    queueInstances.length = 0;
    vi.clearAllMocks();
  });

  it("registers retention, snapshot, and indexer health-check repeatable jobs", async () => {
    const { cronEntries } = await import("./cron");

    expect(cronEntries.map((entry) => entry.id)).toEqual([
      "retention",
      "snapshot",
      "indexer-health-check",
    ]);

    for (const entry of cronEntries) {
      await entry.schedule();
    }

    expect(queueInstances.map((queue) => queue.name)).toEqual([
      "retention-job",
      "snapshot-job",
      "indexer-health-check-job",
    ]);
    expect(queueInstances[0].add).toHaveBeenCalledWith(
      "daily-retention",
      {},
      expect.objectContaining({ repeat: { pattern: "0 2 * * *" } }),
    );
    expect(queueInstances[1].add).toHaveBeenCalledWith(
      "daily-snapshot",
      expect.objectContaining({ timestamp: expect.any(Number) }),
      expect.objectContaining({ repeat: { pattern: "0 0 * * *" } }),
    );
    expect(queueInstances[2].add).toHaveBeenCalledWith(
      "indexer-health-check",
      {},
      expect.objectContaining({ repeat: { pattern: "*/5 * * * *" } }),
    );
    queueInstances.forEach((queue) =>
      expect(queue.close).toHaveBeenCalledTimes(1),
    );
  });

  it("does not add a repeatable job that already exists", async () => {
    const { cronEntries } = await import("./cron");

    queueInstances.push({
      name: "preconfigured-retention-job",
      options: undefined,
      getRepeatableJobs: vi
        .fn()
        .mockResolvedValue([{ name: "daily-retention" }]),
      add: vi.fn().mockResolvedValue({}),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await cronEntries[0].schedule();

    expect(queueInstances[0].add).not.toHaveBeenCalled();
  });
});
