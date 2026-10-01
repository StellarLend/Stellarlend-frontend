import { describe, expect, it } from 'vitest';
import { computeHealthAfterRepayment } from './RepayForm';

describe('RepayForm regression coverage', () => {
  it('caps repayment at the outstanding debt and reaches a terminal health factor', () => {
    expect(computeHealthAfterRepayment(1.5, 100, 150)).toBe(Infinity);
  });

  it('does not improve health for a non-positive repayment', () => {
    expect(computeHealthAfterRepayment(1.5, 100, 0)).toBe(1.5);
    expect(computeHealthAfterRepayment(1.5, 100, -10)).toBe(1.5);
  });
});
