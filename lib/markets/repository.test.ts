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

  it("derives borrowApr, supplyApr, and utilization within expected bounds", async () => {
    const promise = fetchMarkets(["XLM"]);
    await vi.advanceTimersByTimeAsync(200);
    const { markets } = await promise;
    const xlm = markets[0];

    expect(xlm.borrowApr).toBeGreaterThan(11.5);
    expect(xlm.borrowApr).toBeLessThan(12.5);
    expect(xlm.supplyApr).toBeGreaterThan(8.0);
    expect(xlm.supplyApr).toBeLessThan(9.0);
    expect(xlm.utilization).toBeGreaterThanOrEqual(0.66);
    expect(xlm.utilization).toBeLessThanOrEqual(0.76);
    expect(xlm.totalBorrow / xlm.totalSupply).toBeCloseTo(0.71, 1);
  });
});
