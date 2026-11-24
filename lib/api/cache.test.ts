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

  it("returns fresh metadata for a cache hit and a successful load", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10);
    const load = vi.fn().mockResolvedValue(1);

    await expect(cache.getOrLoadWithMeta("k", 1000, load, 0)).resolves.toEqual({
      value: 1,
      isStale: false,
    });
    await expect(cache.getOrLoadWithMeta("k", 1000, load, 500)).resolves.toEqual({
      value: 1,
      isStale: false,
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves stale on loader error within grace", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10, {
      staleIfErrorMs: 100,
    });
    const load = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("upstream unavailable"));

    await cache.getOrLoad("k", 1000, load, 0);
    await expect(cache.getOrLoadWithMeta("k", 1000, load, 1_001)).resolves.toEqual({
      value: 1,
      isStale: true,
    });
  });

  it("rethrows after the stale grace period", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10, {
      staleIfErrorMs: 100,
    });
    const failure = new Error("upstream unavailable");
    const load = vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(failure);

    await cache.getOrLoad("k", 1000, load, 0);
    await expect(cache.getOrLoad("k", 1000, load, 1_100)).rejects.toBe(failure);
  });

  it("shares a failing refresh between concurrent callers", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10, {
      staleIfErrorMs: 100,
    });
    let rejectRefresh!: (error: Error) => void;
    const load = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockReturnValueOnce(
        new Promise<number>((_resolve, reject) => {
          rejectRefresh = reject;
        }),
      );

    await cache.getOrLoad("k", 1000, load, 0);
    const first = cache.getOrLoadWithMeta("k", 1000, load, 1_001);
    const second = cache.getOrLoadWithMeta("k", 1000, load, 1_001);
    expect(load).toHaveBeenCalledTimes(2);

    rejectRefresh(new Error("upstream unavailable"));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: 1, isStale: true },
      { value: 1, isStale: true },
    ]);
  });

  it("allows repeated stale failures before a later successful refresh", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10, {
      staleIfErrorMs: 500,
    });
    const load = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("first failure"))
      .mockRejectedValueOnce(new Error("second failure"))
      .mockResolvedValueOnce(2);

    await cache.getOrLoad("k", 1000, load, 0);
    await expect(cache.getOrLoadWithMeta("k", 1000, load, 1_001)).resolves.toEqual({
      value: 1,
      isStale: true,
    });
    await expect(cache.getOrLoadWithMeta("k", 1000, load, 1_200)).resolves.toEqual({
      value: 1,
      isStale: true,
    });
    await expect(cache.getOrLoadWithMeta("k", 1000, load, 1_501)).resolves.toEqual({
      value: 2,
      isStale: false,
    });
    await expect(cache.getOrLoad("k", 1000, load, 1_600)).resolves.toBe(2);
  });

  it("does not serve stale values when grace is disabled", async () => {
    const cache = new TtlSingleFlightCache<string, number>(10);
    const failure = new Error("upstream unavailable");
    const load = vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(failure);

    await cache.getOrLoad("k", 1000, load, 0);
    await expect(cache.getOrLoad("k", 1000, load, 1_001)).rejects.toBe(failure);
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
