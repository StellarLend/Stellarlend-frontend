import { describe, expect, it } from "vitest";
import {
  ORACLE_PRICE_SCALE,
  MAX_ORACLE_AGE_SECONDS,
  classifyPriceAge,
  decodePriceBounds,
  decodePriceRecord,
  formatAge,
  formatOraclePrice,
  priceToFloat,
} from "./oracle";

describe("lib/oracle", () => {
  describe("decodePriceRecord", () => {
    it("decodes valid PriceRecord object (Some)", () => {
      const record = decodePriceRecord({
        price: 1_200_000n,
        timestamp: 1_700_000_000n,
      });
      expect(record).toEqual({
        price: 1_200_000n,
        timestamp: 1_700_000_000n,
      });
    });

    it("decodes PriceRecord with string/number inputs", () => {
      const record = decodePriceRecord({
        price: "10000000",
        timestamp: 1700000000,
      });
      expect(record).toEqual({
        price: 10_000_000n,
        timestamp: 1_700_000_000n,
      });
    });

    it("returns null for None / missing data", () => {
      expect(decodePriceRecord(null)).toBeNull();
      expect(decodePriceRecord(undefined)).toBeNull();
      expect(decodePriceRecord({})).toBeNull();
      expect(decodePriceRecord({ price: 100n })).toBeNull();
      expect(decodePriceRecord({ timestamp: 100n })).toBeNull();
    });
  });

  describe("decodePriceBounds", () => {
    it("decodes (None, None)", () => {
      expect(decodePriceBounds(null)).toEqual({ min: null, max: null });
      expect(decodePriceBounds([])).toEqual({ min: null, max: null });
      expect(decodePriceBounds([null, null])).toEqual({ min: null, max: null });
    });

    it("decodes (Some, Some) as tuple array", () => {
      const bounds = decodePriceBounds([500_000n, 20_000_000n]);
      expect(bounds).toEqual({
        min: 500_000n,
        max: 20_000_000n,
      });
    });

    it("decodes struct object format", () => {
      const bounds = decodePriceBounds({ min: 1_000_000n, max: 5_000_000n });
      expect(bounds).toEqual({
        min: 1_000_000n,
        max: 5_000_000n,
      });
    });

    it("filters out non-positive bounds", () => {
      const bounds = decodePriceBounds([0n, -100n]);
      expect(bounds).toEqual({ min: null, max: null });
    });
  });

  describe("price scale conversion", () => {
    it("converts known fixture values to expected human prices", () => {
      // 1 XLM @ $0.12 = 1_200_000 with scale 10^7
      expect(priceToFloat(1_200_000n)).toBeCloseTo(0.12, 6);

      // 1 USDC @ $1.00 = 10_000_000 with scale 10^7
      expect(priceToFloat(10_000_000n)).toBe(1.0);

      // 1 BTC @ $67,000 = 670_000_000_000 with scale 10^7
      expect(priceToFloat(670_000_000_000n)).toBe(67000);

      // formatting
      expect(formatOraclePrice(1_200_000n)).toBe("0.12");
      expect(formatOraclePrice(10_000_000n)).toBe("1.00");
    });
  });

  describe("staleness classification", () => {
    const now = 10_000;

    it("classifies missing timestamp as missing", () => {
      const res = classifyPriceAge(null, now);
      expect(res.status).toBe("missing");
      expect(res.ageSeconds).toBeNull();
    });

    it("classifies negative age (future-dated) correctly", () => {
      // timestamp is 5 seconds in the future
      const res = classifyPriceAge(BigInt(now + 5), now);
      expect(res.status).toBe("future");
      expect(res.ageSeconds).toBe(-5);
    });

    it("classifies age at 3599s as fresh", () => {
      const timestamp = BigInt(now - 3599);
      const res = classifyPriceAge(timestamp, now);
      expect(res.status).toBe("fresh");
      expect(res.ageSeconds).toBe(3599);
    });

    it("classifies age at 3600s as fresh (boundary)", () => {
      const timestamp = BigInt(now - 3600);
      const res = classifyPriceAge(timestamp, now);
      expect(res.status).toBe("fresh");
      expect(res.ageSeconds).toBe(3600);
    });

    it("classifies age at 3601s as stale (> 3600s)", () => {
      const timestamp = BigInt(now - 3601);
      const res = classifyPriceAge(timestamp, now);
      expect(res.status).toBe("stale");
      expect(res.ageSeconds).toBe(3601);
    });
  });

  describe("formatAge", () => {
    it("formats durations accurately", () => {
      expect(formatAge(null)).toBe("—");
      expect(formatAge(-10)).toBe("in the future");
      expect(formatAge(15)).toBe("15s ago");
      expect(formatAge(120)).toBe("2m ago");
      expect(formatAge(7200)).toBe("2h ago");
      expect(formatAge(172800)).toBe("2d ago");
    });
  });
});
