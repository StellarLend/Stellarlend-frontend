import { describe, expect, it, vi } from "vitest";
import { TtlSingleFlightCache } from "./cache";

describe("TtlSingleFlightCache", () => {
  it("serves a cached value within the TTL", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10);
    const load = vi.fn().mockResolvedValue(1);

    expect(await cache.getOrLoad("k", 1000, load, 0)).toBe(1);
    expect(await cache.getOrLoad("k", 1000, load, 500)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads after the TTL expires", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10);
    const load = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    expect(await cache.getOrLoad("k", 1000, load, 0)).toBe(1);
    expect(await cache.getOrLoad("k", 1000, load, 1001)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("collapses 100 concurrent misses into one load", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10);
    let resolveLoad!: (value: number) => void;
    const load = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const results = Array.from({ length: 100 }, () =>
      cache.getOrLoad("k", 1000, load),
    );

    expect(load).toHaveBeenCalledTimes(1);
    resolveLoad(42);

    await expect(Promise.all(results)).resolves.toEqual(
      Array.from({ length: 100 }, () => 42),
    );
  });

  it("evicts the least-recently-used entry", async () => {
    const cache = new TtlSingleFlightCache<string, number>(1);
    const loadA = vi.fn().mockResolvedValue(1);
    const loadB = vi.fn().mockResolvedValue(2);

    await cache.getOrLoad("a", 1000, loadA, 0);
    await cache.getOrLoad("b", 1000, loadB, 0);
    await cache.getOrLoad("a", 1000, loadA, 0);

    expect(loadA).toHaveBeenCalledTimes(2);
  });
});
