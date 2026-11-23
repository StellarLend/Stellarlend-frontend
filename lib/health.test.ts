import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  HEALTH_FACTOR_NO_DEBT,
  I128_MAX,
  classifyHealth,
  decodeHealthFactor,
  formatHealthFactor,
  validateThresholds,
  loadThresholds,
  saveThresholds,
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
describe("health monitor storage", () => {

  it("loadThresholds falls back when no value is stored", () => {
    expect(loadThresholds("new-wallet")).toEqual(DEFAULT_THRESHOLDS);
  });

  it("loadThresholds falls back when stored thresholds fail validation", () => {
    window.localStorage.setItem(
      "stellarlend:health:thresholds:wallet-invalid",
      JSON.stringify({ warning: 1.1, danger: 1.3 }),
    );
    expect(loadThresholds("wallet-invalid")).toEqual(DEFAULT_THRESHOLDS);
  });

  it("loadThresholds falls back on corrupt JSON", () => {
    window.localStorage.setItem("stellarlend:health:thresholds:wallet-a", "{invalid");
    expect(loadThresholds("wallet-a")).toEqual(DEFAULT_THRESHOLDS);
  });

  it("loadThresholds falls back when storage throws", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    try {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("Storage access denied");
        },
      });
      expect(loadThresholds("wallet-a")).toEqual(DEFAULT_THRESHOLDS);
    } finally {
      if (descriptor) {
        Object.defineProperty(window, "localStorage", descriptor);
      }
    }
  });

  it("thresholds are stored per user", () => {
    const walletA = { warning: 1.8, danger: 1.3 };
    const walletB = { warning: 1.6, danger: 1.1 };

    saveThresholds("GUSERA", walletA);
    saveThresholds("GUSERB", walletB);

    expect(loadThresholds("GUSERA")).toEqual(walletA);
    expect(loadThresholds("GUSERB")).toEqual(walletB);
  });
});
