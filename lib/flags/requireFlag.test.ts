import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateFlag } from "./evaluator";
import { requireFlag } from "./requireFlag";

vi.mock("./evaluator", () => ({
  evaluateFlag: vi.fn(),
}));

const evaluateFlagMock = vi.mocked(evaluateFlag);

describe("requireFlag", () => {
  beforeEach(() => {
    evaluateFlagMock.mockReset();
  });

  it("allows an enabled flag to pass through without throwing", () => {
    evaluateFlagMock.mockReturnValue(true);

    expect(() => requireFlag("accountExport", "user-123")).not.toThrow();
    expect(evaluateFlagMock).toHaveBeenCalledWith("accountExport", "user-123");
  });

  it("blocks a disabled flag with the existing enforcement error", () => {
    evaluateFlagMock.mockReturnValue(false);

    expect(() => requireFlag("accountExport", "user-123")).toThrow(
      "Feature flag 'accountExport' is disabled for user 'user-123'.",
    );
  });

  it("treats unknown flags as safely closed when the evaluator returns false", () => {
    evaluateFlagMock.mockReturnValue(false);

    expect(() => requireFlag("unknownFlag", "user-456")).toThrow(
      "Feature flag 'unknownFlag' is disabled for user 'user-456'.",
    );
    expect(evaluateFlagMock).toHaveBeenCalledWith("unknownFlag", "user-456");
  });

  it("respects bucketed or percentage rollout decisions from the evaluator", () => {
    evaluateFlagMock.mockReturnValueOnce(true).mockReturnValueOnce(false);

    expect(() => requireFlag("rolloutFlag", "bucket-in")).not.toThrow();
    expect(() => requireFlag("rolloutFlag", "bucket-out")).toThrow(
      "Feature flag 'rolloutFlag' is disabled for user 'bucket-out'.",
    );
    expect(evaluateFlagMock).toHaveBeenNthCalledWith(
      1,
      "rolloutFlag",
      "bucket-in",
    );
    expect(evaluateFlagMock).toHaveBeenNthCalledWith(
      2,
      "rolloutFlag",
      "bucket-out",
    );
  });

  it("propagates evaluator errors without rewriting production behavior", () => {
    const evaluatorError = new Error("feature flag config could not be read");
    evaluateFlagMock.mockImplementation(() => {
      throw evaluatorError;
    });

    expect(() => requireFlag("configBackedFlag", "user-789")).toThrow(
      evaluatorError,
    );
  });
});
