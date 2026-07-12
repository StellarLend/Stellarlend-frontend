import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchMarkets } from "./repository";

describe("lib/markets/repository", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns market rows for requested assets", async () => {
    const promise = fetchMarkets(["XLM", "USDC"]);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result.markets).toHaveLength(2);
    expect(result.markets[0].asset).toBe("XLM");
    expect(result.source).toContain("Soroban");
  });
});
