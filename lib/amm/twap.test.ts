import { describe, expect, it } from "vitest";
import { twapBetween, twapSeries, type TwapObservation } from "./twap";

describe("twapBetween", () => {
  it("matches a hand-computed value between two observations", () => {
    const obsA: TwapObservation = { timestamp: 1000n, cumNum: 10_000n, cumDenom: 10n };
    const obsB: TwapObservation = { timestamp: 1060n, cumNum: 22_000n, cumDenom: 20n };

    const price = twapBetween(obsA, obsB);
    expect(price).toBe("1200");
  });

  it("formats decimal quotient correctly", () => {
    const obsA: TwapObservation = { timestamp: 100n, cumNum: 0n, cumDenom: 0n };
    const obsB: TwapObservation = { timestamp: 160n, cumNum: 5n, cumDenom: 2n };

    expect(twapBetween(obsA, obsB)).toBe("2.5");
  });

  it("skips/returns null when zero time/denom delta occurs", () => {
    const obsA: TwapObservation = { timestamp: 1000n, cumNum: 100n, cumDenom: 10n };
    const obsB: TwapObservation = { timestamp: 1000n, cumNum: 200n, cumDenom: 10n };

    expect(twapBetween(obsA, obsB)).toBeNull();
  });

  it("handles very large cumulative values near i128::MAX without losing precision", () => {
    const I128_MAX = (1n << 127n) - 1n;
    const obsA: TwapObservation = {
      timestamp: 1000n,
      cumNum: I128_MAX - 100_000_000_000n,
      cumDenom: 1_000_000n,
    };
    const obsB: TwapObservation = {
      timestamp: 2000n,
      cumNum: I128_MAX,
      cumDenom: 2_000_000n,
    };

    const price = twapBetween(obsA, obsB);
    expect(price).toBe("100000");
  });
});

describe("twapSeries", () => {
  it("returns empty series for 0 or 1 observation", () => {
    expect(twapSeries([])).toEqual([]);
    expect(twapSeries([{ timestamp: 100n, cumNum: 10n, cumDenom: 1n }])).toEqual([]);
  });

  it("constructs series for multiple observations", () => {
    const observations: TwapObservation[] = [
      { timestamp: 1000n, cumNum: 100n, cumDenom: 10n },
      { timestamp: 1060n, cumNum: 220n, cumDenom: 20n },
      { timestamp: 1120n, cumNum: 370n, cumDenom: 30n },
    ];

    const series = twapSeries(observations);
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ timestamp: 1060, price: "12" });
    expect(series[1]).toEqual({ timestamp: 1120, price: "15" });
  });

  it("skips pairs with zero denominator delta in a series", () => {
    const observations: TwapObservation[] = [
      { timestamp: 1000n, cumNum: 100n, cumDenom: 10n },
      { timestamp: 1000n, cumNum: 150n, cumDenom: 10n },
      { timestamp: 1060n, cumNum: 250n, cumDenom: 20n },
    ];

    const series = twapSeries(observations);
    expect(series).toHaveLength(1);
    expect(series[0].timestamp).toBe(1060);
  });

  it("respects time window filter", () => {
    const observations: TwapObservation[] = [
      { timestamp: 1000n, cumNum: 100n, cumDenom: 10n },
      { timestamp: 2000n, cumNum: 200n, cumDenom: 20n },
      { timestamp: 5000n, cumNum: 500n, cumDenom: 50n },
    ];

    const series = twapSeries(observations, 1000);
    expect(series).toHaveLength(1);
    expect(series[0].timestamp).toBe(5000);
  });

  it("downsamples if series exceeds maxPoints", () => {
    const observations: TwapObservation[] = [];
    for (let i = 0; i <= 20; i++) {
      observations.push({
        timestamp: BigInt(1000 + i * 60),
        cumNum: BigInt(i * 100),
        cumDenom: BigInt(i * 10),
      });
    }

    const series = twapSeries(observations, undefined, 5);
    expect(series.length).toBe(5);
  });
});
