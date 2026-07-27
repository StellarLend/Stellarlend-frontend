import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEvaluateAllFlags = vi.hoisted(() => vi.fn());

vi.mock("@/lib/flags/evaluator", () => ({
  evaluateAllFlags: mockEvaluateAllFlags,
}));

const TTL_MS = 5 * 60 * 1000;

function featureFlagRequest(userId?: string) {
  return new Request("http://localhost/api/feature-flags", {
    headers: userId ? { "x-user-id": userId } : undefined,
  });
}

async function importFreshRoute() {
  vi.resetModules();
  return import("./route");
}

describe("GET /api/feature-flags", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T00:00:00Z"));
    mockEvaluateAllFlags.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("evaluates once and serves same-user requests from cache inside the TTL", async () => {
    mockEvaluateAllFlags
      .mockReturnValueOnce({ newDashboard: true })
      .mockReturnValueOnce({ newDashboard: false });

    const { GET } = await importFreshRoute();

    const first = await GET(featureFlagRequest("alice"));
    const second = await GET(featureFlagRequest("alice"));

    await expect(first.json()).resolves.toEqual({ newDashboard: true });
    await expect(second.json()).resolves.toEqual({ newDashboard: true });
    expect(mockEvaluateAllFlags).toHaveBeenCalledTimes(1);
    expect(mockEvaluateAllFlags).toHaveBeenCalledWith("alice");
  });

  it("keeps cache entries isolated per x-user-id", async () => {
    mockEvaluateAllFlags
      .mockReturnValueOnce({ betaBorrow: true })
      .mockReturnValueOnce({ betaBorrow: false });

    const { GET } = await importFreshRoute();

    const alice = await GET(featureFlagRequest("alice"));
    const bob = await GET(featureFlagRequest("bob"));

    await expect(alice.json()).resolves.toEqual({ betaBorrow: true });
    await expect(bob.json()).resolves.toEqual({ betaBorrow: false });
    expect(mockEvaluateAllFlags).toHaveBeenNthCalledWith(1, "alice");
    expect(mockEvaluateAllFlags).toHaveBeenNthCalledWith(2, "bob");
  });

  it("uses anonymous as the cache key when x-user-id is missing", async () => {
    mockEvaluateAllFlags.mockReturnValue({ publicPreview: true });

    const { GET } = await importFreshRoute();

    const first = await GET(featureFlagRequest());
    const second = await GET(featureFlagRequest());

    await expect(first.json()).resolves.toEqual({ publicPreview: true });
    await expect(second.json()).resolves.toEqual({ publicPreview: true });
    expect(mockEvaluateAllFlags).toHaveBeenCalledTimes(1);
    expect(mockEvaluateAllFlags).toHaveBeenCalledWith("anonymous");
  });

  it("re-evaluates after the five-minute cache TTL expires", async () => {
    mockEvaluateAllFlags
      .mockReturnValueOnce({ marketCards: true })
      .mockReturnValueOnce({ marketCards: false });

    const { GET } = await importFreshRoute();

    const cached = await GET(featureFlagRequest("alice"));
    vi.advanceTimersByTime(TTL_MS - 1);
    const stillCached = await GET(featureFlagRequest("alice"));

    vi.advanceTimersByTime(2);
    const refreshed = await GET(featureFlagRequest("alice"));

    await expect(cached.json()).resolves.toEqual({ marketCards: true });
    await expect(stillCached.json()).resolves.toEqual({ marketCards: true });
    await expect(refreshed.json()).resolves.toEqual({ marketCards: false });
    expect(mockEvaluateAllFlags).toHaveBeenCalledTimes(2);
  });
});
