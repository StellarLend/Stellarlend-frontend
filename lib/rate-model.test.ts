import { describe, expect, it } from "vitest";
import { nativeToScVal } from "@stellar/stellar-sdk";
import {
  BPS_DENOM,
  DEFAULT_APR_BPS,
  DEFAULT_RATE_PARAMS,
  I128_MAX,
  borrowRateBps,
  buildDemoRateModelSnapshot,
  decodeRateModelDiagnostics,
  decodeRateParams,
  decodeUtilizationHistory,
  formatBpsPercent,
  sampleBorrowRateCurve,
  type RateParams,
} from "./rate-model";

describe("lib/rate-model — contract parity & regression tests", () => {
  it("matches RateParams::default() contract constants from interest_rate_regression_test.rs", () => {
    expect(BPS_DENOM).toBe(10_000n);
    expect(DEFAULT_APR_BPS).toBe(500n);
    expect(DEFAULT_RATE_PARAMS).toEqual({
      base_rate_bps: 100n,
      kink_utilization_bps: 8_000n,
      multiplier_bps: 2_000n,
      jump_multiplier_bps: 10_000n,
      rate_floor_bps: 50n,
      rate_ceiling_bps: 10_000n,
      max_rate_change_per_ledger_bps: I128_MAX,
      hysteresis_bps: 0n,
      surcharge_kink_bps: 10_000n,
      surcharge_slope: 0n,
    });
  });

  it("reproduces the contract formula across >= 12 cross-checked utilization points including 0, kink-1, kink, kink+1, 10000", () => {
    // Expected values verified against compute_borrow_rate in rate_model.rs & interest_rate_regression_test.rs:
    // below kink (<= 8000): 100 + trunc(u * 2000 / 10000)
    // above kink (> 8000):  1700 + trunc((u - 8000) * 10000 / 10000)
    const crossCheckPoints: Array<[bigint, bigint]> = [
      [0n, 100n],        // 0% utilization -> base rate 100 bps
      [5n, 101n],        // 0.05% -> 100 + trunc(10000 / 10000) = 101 bps
      [7n, 101n],        // truncating integer division check: 100 + trunc(14000 / 10000) = 101 bps
      [1_000n, 300n],    // 10% -> 100 + 200 = 300 bps
      [2_500n, 600n],    // 25% -> 100 + 500 = 600 bps
      [5_000n, 1_100n],  // 50% -> 100 + 1000 = 1100 bps
      [6_500n, 1_400n],  // 65% -> 100 + 1300 = 1400 bps
      [7_999n, 1_699n],  // kink - 1: 100 + trunc(7999 * 2000 / 10000) = 100 + 1599 = 1699 bps
      [8_000n, 1_700n],  // kink (80%): 100 + 1600 = 1700 bps
      [8_001n, 1_701n],  // kink + 1: 1700 + trunc(1 * 10000 / 10000) = 1701 bps
      [8_500n, 2_200n],  // 85% -> 1700 + 500 = 2200 bps
      [9_000n, 2_700n],  // 90% -> 1700 + 1000 = 2700 bps
      [9_500n, 3_200n],  // 95% -> 1700 + 1500 = 3200 bps
      [10_000n, 3_700n], // 100% -> 1700 + 2000 = 3700 bps
    ];

    for (const [utilBps, expectedRateBps] of crossCheckPoints) {
      expect(borrowRateBps(utilBps, DEFAULT_RATE_PARAMS)).toBe(expectedRateBps);
    }
  });

  it("matches truncating Rust integer division for non-divisible slopes", () => {
    const customParams: RateParams = {
      ...DEFAULT_RATE_PARAMS,
      base_rate_bps: 100n,
      kink_utilization_bps: 3_333n,
      multiplier_bps: 1_777n,
      jump_multiplier_bps: 9_999n,
      rate_floor_bps: 0n,
    };
    // At u = 1_234: 100 + trunc(1234 * 1777 / 10000) = 100 + trunc(2192818 / 10000) = 100 + 219 = 319
    expect(borrowRateBps(1_234n, customParams)).toBe(319n);

    // At u = 3_334 (kink + 1):
    // pre = 100 + trunc(3333 * 1777 / 10000) = 100 + trunc(5922741 / 10000) = 100 + 592 = 692
    // jump = trunc(1 * 9999 / 10000) = 0
    expect(borrowRateBps(3_334n, customParams)).toBe(692n);
  });

  it("enforces rate_floor_bps and rate_ceiling_bps clamping (ported from interest_rate_regression_test.rs)", () => {
    // floor_clamps_low_rate
    const floorParams: RateParams = {
      ...DEFAULT_RATE_PARAMS,
      base_rate_bps: 0n,
      multiplier_bps: 0n,
      jump_multiplier_bps: 0n,
      rate_floor_bps: 200n,
    };
    expect(borrowRateBps(0n, floorParams)).toBe(200n);
    expect(borrowRateBps(5_000n, floorParams)).toBe(200n);

    // ceiling_clamps_high_rate
    const ceilingParams: RateParams = {
      ...DEFAULT_RATE_PARAMS,
      rate_ceiling_bps: 1_000n,
    };
    expect(borrowRateBps(10_000n, ceilingParams)).toBe(1_000n);

    // floor_equals_ceiling_always_returns_that_value
    const flatParams: RateParams = {
      ...DEFAULT_RATE_PARAMS,
      rate_floor_bps: 500n,
      rate_ceiling_bps: 500n,
    };
    for (const u of [0n, 4_000n, 8_000n, 10_000n]) {
      expect(borrowRateBps(u, flatParams)).toBe(500n);
    }
  });

  it("handles kink_utilization_bps = 0 and kink_utilization_bps = 10_000 extremes", () => {
    // Extreme 1: kink at 0 bps -> entire curve uses jump_multiplier_bps
    const kinkZeroParams: RateParams = {
      ...DEFAULT_RATE_PARAMS,
      base_rate_bps: 100n,
      kink_utilization_bps: 0n,
      multiplier_bps: 2_000n,
      jump_multiplier_bps: 10_000n,
    };
    expect(borrowRateBps(0n, kinkZeroParams)).toBe(100n);
    expect(borrowRateBps(1n, kinkZeroParams)).toBe(101n);
    expect(borrowRateBps(5_000n, kinkZeroParams)).toBe(5_100n);
    expect(borrowRateBps(10_000n, kinkZeroParams)).toBe(10_000n); // 10100 clamped to ceiling 10000

    // Extreme 2: kink at 10_000 bps -> entire curve uses multiplier_bps, jump branch never triggers
    const kinkFullParams: RateParams = {
      ...DEFAULT_RATE_PARAMS,
      base_rate_bps: 100n,
      kink_utilization_bps: 10_000n,
      multiplier_bps: 2_000n,
      jump_multiplier_bps: 50_000n,
    };
    expect(borrowRateBps(0n, kinkFullParams)).toBe(100n);
    expect(borrowRateBps(5_000n, kinkFullParams)).toBe(1_100n);
    expect(borrowRateBps(9_999n, kinkFullParams)).toBe(2_099n);
    expect(borrowRateBps(10_000n, kinkFullParams)).toBe(2_100n);
  });

  it("reproduces emergency surcharge band values from rate_surcharge_test.rs", () => {
    const surchargeParams: RateParams = {
      ...DEFAULT_RATE_PARAMS,
      surcharge_kink_bps: 9_500n,
      surcharge_slope: 80_000n,
    };
    // At 95% (surcharge kink): 1700 + 1500 = 3200 bps (no surcharge yet)
    expect(borrowRateBps(9_500n, surchargeParams)).toBe(3_200n);
    // At 100%: raw 3700 + surcharge ((10000 - 9500) * 80000 / 10000 = 4000) = 7700 bps
    expect(borrowRateBps(10_000n, surchargeParams)).toBe(7_700n);

    // Ceiling clamps surcharged rate
    const cappedSurcharge: RateParams = {
      ...surchargeParams,
      rate_ceiling_bps: 5_000n,
    };
    expect(borrowRateBps(10_000n, cappedSurcharge)).toBe(5_000n);
  });

  it("clamps utilization above 10_000 and below 0 defensively", () => {
    expect(borrowRateBps(10_001n, DEFAULT_RATE_PARAMS)).toBe(
      borrowRateBps(10_000n, DEFAULT_RATE_PARAMS)
    );
    expect(borrowRateBps(25_000n, DEFAULT_RATE_PARAMS)).toBe(3_700n);
    expect(borrowRateBps(-500n, DEFAULT_RATE_PARAMS)).toBe(
      borrowRateBps(0n, DEFAULT_RATE_PARAMS)
    );
  });

  it("is monotonic non-decreasing across the entire 0..=10_000 bps domain", () => {
    let prev = -1n;
    for (let u = 0n; u <= 10_000n; u += 25n) {
      const rate = borrowRateBps(u, DEFAULT_RATE_PARAMS);
      expect(rate >= prev).toBe(true);
      prev = rate;
    }
  });

  it("samples the borrow rate curve including exact kink and endpoints", () => {
    const curve = sampleBorrowRateCurve(DEFAULT_RATE_PARAMS, 1_000n);
    const utils = curve.map((p) => p.utilizationBps);
    expect(utils[0]).toBe(0n);
    expect(utils[utils.length - 1]).toBe(10_000n);
    expect(utils).toContain(8_000n);
  });
});

describe("lib/rate-model — Soroban ScVal and object decoding", () => {
  it("decodes RateParams from Soroban ScVal map and plain object", () => {
    const scVal = nativeToScVal({
      base_rate_bps: 100n,
      kink_utilization_bps: 8_000n,
      multiplier_bps: 2_000n,
      jump_multiplier_bps: 10_000n,
      rate_floor_bps: 50n,
      rate_ceiling_bps: 10_000n,
      max_rate_change_per_ledger_bps: 500n,
      hysteresis_bps: 10n,
      surcharge_kink_bps: 9_500n,
      surcharge_slope: 40_000n,
    });

    const decoded = decodeRateParams(scVal);
    expect(decoded).toEqual({
      base_rate_bps: 100n,
      kink_utilization_bps: 8_000n,
      multiplier_bps: 2_000n,
      jump_multiplier_bps: 10_000n,
      rate_floor_bps: 50n,
      rate_ceiling_bps: 10_000n,
      max_rate_change_per_ledger_bps: 500n,
      hysteresis_bps: 10n,
      surcharge_kink_bps: 9_500n,
      surcharge_slope: 40_000n,
    });

    expect(() =>
      decodeRateParams({ ...decoded, multiplier_bps: -1n })
    ).toThrow(/negative/i);
  });

  it("decodes RateModelDiagnostics from Soroban ScVal and clamps utilization > 10_000", () => {
    const scVal = nativeToScVal({
      rate_model_active: true,
      utilization_bps: 8_250n,
      target_rate_bps: 1_950n,
      applied_rate_bps: 1_820n,
      last_update_ledger: 420_100,
      elapsed_ledgers: 12,
    });

    const decoded = decodeRateModelDiagnostics(scVal);
    expect(decoded).toEqual({
      rate_model_active: true,
      utilization_bps: 8_250n,
      target_rate_bps: 1_950n,
      applied_rate_bps: 1_820n,
      last_update_ledger: 420_100,
      elapsed_ledgers: 12,
    });

    // Defensive clamping when utilization exceeds 10_000 bps
    const overUtil = decodeRateModelDiagnostics({
      rate_model_active: false,
      utilization_bps: 14_500n,
      target_rate_bps: 500n,
      applied_rate_bps: 500n,
      last_update_ledger: 0,
      elapsed_ledgers: 0,
    });
    expect(overUtil.rate_model_active).toBe(false);
    expect(overUtil.utilization_bps).toBe(10_000n);
    expect(overUtil.applied_rate_bps).toBe(500n);
  });

  it("decodes Vec<UtilizationSample> from Soroban ScVal and empty vectors", () => {
    const scValVec = nativeToScVal([
      { ledger: 900_010, utilization_bps: 7_500n },
      { ledger: 900_005, utilization_bps: 12_000n }, // clamped to 10_000n
      { ledger: 900_000, utilization_bps: 6_800n },
    ]);

    const history = decodeUtilizationHistory(scValVec);
    expect(history).toEqual([
      { ledger: 900_010, utilization_bps: 7_500n },
      { ledger: 900_005, utilization_bps: 10_000n },
      { ledger: 900_000, utilization_bps: 6_800n },
    ]);

    const emptyVec = nativeToScVal([]);
    expect(decodeUtilizationHistory(emptyVec)).toEqual([]);
  });

  it("formats basis points and builds demo snapshot cleanly", () => {
    expect(formatBpsPercent(1_700n)).toBe("17.00%");
    const demo = buildDemoRateModelSnapshot(8_000n);
    expect(demo.diagnostics.target_rate_bps).toBe(1_700n);
    expect(demo.history.length).toBeGreaterThan(0);
  });
});
