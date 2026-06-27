import { afterEach, describe, expect, it, vi } from "vitest";
import type { Flags } from "./evaluator";

const originalNodeEnv = process.env.NODE_ENV;

async function loadEvaluator(flags: Flags) {
  vi.resetModules();
  process.env.NODE_ENV = "test";

  vi.doMock("fs", () => ({
    default: {
      readFileSync: vi.fn(() => JSON.stringify(flags)),
    },
  }));

  return import("./evaluator");
}

afterEach(() => {
  vi.doUnmock("fs");
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe("feature flag evaluator", () => {
  it("returns a safe disabled default for unknown flag keys", async () => {
    const { evaluateFlag } = await loadEvaluator({
      knownFlag: {
        enabled: true,
        rollout: 100,
      },
    });

    expect(evaluateFlag("missingFlag", "user-1")).toBe(false);
  });

  it("is deterministic for the same user and flag across repeated calls", async () => {
    const { evaluateFlag } = await loadEvaluator({
      betaDashboard: {
        enabled: true,
        rollout: 35,
      },
    });

    const first = evaluateFlag("betaDashboard", "alice");
    const second = evaluateFlag("betaDashboard", "alice");
    const third = evaluateFlag("betaDashboard", "alice");

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("honors disabled, zero-percent, and full-rollout flags", async () => {
    const { evaluateFlag } = await loadEvaluator({
      disabledFlag: {
        enabled: false,
        rollout: 100,
      },
      zeroRollout: {
        enabled: true,
        rollout: 0,
      },
      fullRollout: {
        enabled: true,
        rollout: 100,
      },
    });

    expect(evaluateFlag("disabledFlag", "alice")).toBe(false);
    expect(evaluateFlag("zeroRollout", "alice")).toBe(false);
    expect(evaluateFlag("fullRollout", "alice")).toBe(true);
  });

  it("applies user overrides before enabled and rollout checks", async () => {
    const { evaluateFlag } = await loadEvaluator({
      inviteOnlyFeature: {
        enabled: false,
        rollout: 0,
        overrides: {
          alice: true,
          bob: false,
        },
      },
    });

    expect(evaluateFlag("inviteOnlyFeature", "alice")).toBe(true);
    expect(evaluateFlag("inviteOnlyFeature", "bob")).toBe(false);
    expect(evaluateFlag("inviteOnlyFeature", "carol")).toBe(false);
  });

  it("buckets rollout users proportionally with deterministic sample input", async () => {
    const { evaluateFlag } = await loadEvaluator({
      halfRollout: {
        enabled: true,
        rollout: 50,
      },
    });

    const enabledCount = Array.from(
      { length: 1000 },
      (_, index) => `user-${index}`,
    ).filter((userId) => evaluateFlag("halfRollout", userId)).length;

    expect(enabledCount).toBeGreaterThanOrEqual(450);
    expect(enabledCount).toBeLessThanOrEqual(550);
  });

  it("evaluates every configured flag for a user", async () => {
    const { evaluateAllFlags } = await loadEvaluator({
      enabledFeature: {
        enabled: true,
        rollout: 100,
      },
      disabledFeature: {
        enabled: false,
      },
      overriddenFeature: {
        enabled: false,
        overrides: {
          alice: true,
        },
      },
    });

    expect(evaluateAllFlags("alice")).toEqual({
      enabledFeature: true,
      disabledFeature: false,
      overriddenFeature: true,
    });
  });
});
