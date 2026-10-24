import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  HEALTH_FACTOR_NO_DEBT,
  I128_MAX,
  classifyHealth,
  decodeHealthFactor,
  formatHealthFactor,
  validateThresholds,
} from "./health";

const raw = (n: number) => BigInt(n);

describe("decodeHealthFactor", () => {
  it("decodes the 10000 scale", () => {
    const one = decodeHealthFactor(raw(10000));
    expect(one.value).toBe(1);
    expect(formatHealthFactor(one)).toBe("1.00");

    const below = decodeHealthFactor(raw(9999));
    expect(below.value).toBe(0.9999);
  });

  it("treats the no-debt sentinel as no debt", () => {
    const h = decodeHealthFactor(HEALTH_FACTOR_NO_DEBT);
    expect(h.value).toBeNull();
    expect(h.status).toBe("no-debt");
    expect(formatHealthFactor(h)).toBe("No debt");
  });

  it("treats i128::MAX overflow as very safe, not a number", () => {
    const h = decodeHealthFactor(I128_MAX);
    expect(h.value).toBeNull();
    expect(h.status).toBe("very-safe");
    expect(formatHealthFactor(h)).toBe("Very safe");
    expect(classifyHealth(h, DEFAULT_THRESHOLDS)).toBe("safe");
  });
});

describe("formatHealthFactor", () => {
  it("truncates instead of rounding up", () => {
    expect(formatHealthFactor(decodeHealthFactor(raw(9999)))).toBe("0.99");
    expect(formatHealthFactor(decodeHealthFactor(raw(11500)))).toBe("1.15");
    expect(formatHealthFactor(decodeHealthFactor(raw(12345)))).toBe("1.23");
  });
});

describe("classifyHealth", () => {
  const level = (n: number) =>
    classifyHealth(decodeHealthFactor(raw(n)), DEFAULT_THRESHOLDS);

  it("uses the default 1.5 / 1.2 / 1.0 boundaries", () => {
    expect(level(15000)).toBe("safe");
    expect(level(14999)).toBe("warning");
    expect(level(12000)).toBe("warning");
    expect(level(11999)).toBe("danger");
    expect(level(10000)).toBe("danger");
    expect(level(9999)).toBe("liquidatable");
  });
});

describe("validateThresholds", () => {
  it("accepts the defaults", () => {
    expect(validateThresholds(DEFAULT_THRESHOLDS)).toBeNull();
  });
  it("rejects danger >= warning", () => {
    expect(validateThresholds({ warning: 1.2, danger: 1.2 })).toMatch(/lower/);
    expect(validateThresholds({ warning: 1.2, danger: 1.5 })).toMatch(/lower/);
  });
  it("rejects danger at or below 1.0 and non-numbers", () => {
    expect(validateThresholds({ warning: 1.5, danger: 1 })).toMatch(/above 1/);
    expect(validateThresholds({ warning: NaN, danger: 1.2 })).toMatch(/numbers/);
  });
});