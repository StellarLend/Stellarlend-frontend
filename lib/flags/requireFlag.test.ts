import { describe, it, expect, vi } from "vitest";

vi.mock("./evaluator", () => ({
  evaluateFlag: vi.fn(),
}));

import { evaluateFlag } from "./evaluator";
import { requireFlag } from "./requireFlag";

describe("requireFlag", () => {
  const flagKey = "my-feature";
  const userId = "user-abc-123";

  it("does not throw when evaluateFlag returns true", () => {
    vi.mocked(evaluateFlag).mockReturnValue(true);
    expect(() => requireFlag(flagKey, userId)).not.toThrow();
    expect(evaluateFlag).toHaveBeenCalledWith(flagKey, userId);
  });

  it("throws when evaluateFlag returns false", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag(flagKey, userId)).toThrow(Error);
  });

  it("includes the flag key in the error message", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag("beta-feature", userId)).toThrow(/beta-feature/);
  });

  it("includes the user id in the error message", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag(flagKey, "user-xyz")).toThrow(/user-xyz/);
  });

  it("throws a standard Error (not a custom subclass)", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    try {
      requireFlag(flagKey, userId);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.constructor.name).toBe("Error");
    }
  });

  it("passes both arguments to evaluateFlag", () => {
    vi.mocked(evaluateFlag).mockReturnValue(true);
    requireFlag("a", "b");
    expect(evaluateFlag).toHaveBeenCalledWith("a", "b");
  });

  it("calls evaluateFlag exactly once per invocation", () => {
    vi.mocked(evaluateFlag).mockReset();
    vi.mocked(evaluateFlag).mockReturnValue(true);
    requireFlag("single-call", "u1");
    expect(evaluateFlag).toHaveBeenCalledTimes(1);
  });
});

describe("requireFlag edge cases", () => {
  beforeEach(() => {
    vi.mocked(evaluateFlag).mockReset();
  });

  it("handles empty flagKey (disabled)", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag("", "u")).toThrow(Error);
  });

  it("handles empty flagKey (enabled)", () => {
    vi.mocked(evaluateFlag).mockReturnValue(true);
    expect(() => requireFlag("", "u")).not.toThrow();
  });

  it("handles empty userId (disabled)", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag("f", "")).toThrow(/disabled for user ''/);
  });

  it("handles empty userId (enabled)", () => {
    vi.mocked(evaluateFlag).mockReturnValue(true);
    expect(() => requireFlag("f", "")).not.toThrow();
  });

  it("handles Unicode in userId", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag("f", "ユーザー 👋 العربي")).toThrow(Error);
  });

  it("handles very long flagKey and userId", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    const long = "x".repeat(500);
    expect(() => requireFlag(long, long)).toThrow(Error);
  });
});

describe("requireFlag performance", () => {
  it("evaluates quickly for 10k calls", () => {
    vi.mocked(evaluateFlag).mockReturnValue(true);
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      requireFlag("flag-" + i, "user-" + i);
    }
    expect(performance.now() - start).toBeLessThan(100);
  });
});
