import { describe, expect, it, vi } from "vitest";
import { requireFlag } from "./requireFlag";
import { evaluateFlag } from "./evaluator";

vi.mock("./evaluator", () => ({
  evaluateFlag: vi.fn(),
}));

describe("requireFlag", () => {
  it("passes when the flag is enabled", () => {
    vi.mocked(evaluateFlag).mockReturnValue(true);
    expect(() => requireFlag("beta-dashboard", "user-1")).not.toThrow();
  });

  it("throws when the flag is disabled", () => {
    vi.mocked(evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag("beta-dashboard", "user-1")).toThrow(
      /Feature flag 'beta-dashboard' is disabled/,
    );
  });
});
