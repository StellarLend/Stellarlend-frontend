import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeRiskScore, computeLiquidationPriceFactor, computeHealthFactor, SAFE_HEALTH_FACTOR } from './liquidation';

describe('liquidation risk-score properties', () => {

  it('risk score decreases monotonically as health factor increases', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        (hf1, hf2) => {
          const r1 = computeRiskScore(hf1);
          const r2 = computeRiskScore(hf2);

          if (hf1 < hf2) {
            expect(r1).toBeGreaterThanOrEqual(r2);
          } else if (hf1 > hf2) {
            expect(r1).toBeLessThanOrEqual(r2);
          } else {
            expect(r1).toBe(r2);
          }
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });

  it('risk score is always between 0 and 1 inclusive', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        (hf) => {
          const score = computeRiskScore(hf);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });

  it('risk score is 1 for health factors at or below 1', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        (hf) => {
          expect(computeRiskScore(hf)).toBe(1);
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });

  it('risk score is 0 for health factors at or above SAFE_HEALTH_FACTOR', () => {
    fc.assert(
      fc.property(
        fc.double({ min: SAFE_HEALTH_FACTOR, max: 100, noNaN: true }),
        (hf) => {
          expect(computeRiskScore(hf)).toBe(0);
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });

  it('liquidation price factor increases with borrowed amount', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        (amount1, amount2, cf) => {
          const collateral = 5000;
          const a1 = Math.min(amount1, amount2);
          const a2 = Math.max(amount1, amount2);

          const f1 = computeLiquidationPriceFactor(a1, collateral, cf);
          const f2 = computeLiquidationPriceFactor(a2, collateral, cf);

          if (f1 !== null && f2 !== null) {
            expect(f2).toBeGreaterThanOrEqual(f1);
          }
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });

  it('health factor decreases as borrowed amount increases', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        (amount1, amount2, cf) => {
          const collateral = 5000;
          const a1 = Math.min(amount1, amount2);
          const a2 = Math.max(amount1, amount2);

          const hf1 = computeHealthFactor(collateral, cf, a1);
          const hf2 = computeHealthFactor(collateral, cf, a2);

          if (hf1 !== null && hf2 !== null) {
            expect(hf1).toBeGreaterThanOrEqual(hf2);
          }
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });

  it('all compute results are finite numbers for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 100000, noNaN: true }),
        fc.double({ min: 1, max: 100000, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        (borrowed, collateral, cf) => {
          const lpf = computeLiquidationPriceFactor(borrowed, collateral, cf);
          const hf = computeHealthFactor(collateral, cf, borrowed);

          if (lpf !== null) {
            expect(Number.isFinite(lpf)).toBe(true);
          }
          if (hf !== null) {
            expect(Number.isFinite(hf)).toBe(true);
          }
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});
