import { describe, expect, it } from 'vitest';
import { calculateCoverageRatio, calculateInsuranceShare, decodeBadDebtWriteOffEvent, formatPercentFromBps } from './solvency';

describe('solvency calculations', () => {
  it('handles zero-debt and over-funded edge cases', () => {
    expect(calculateCoverageRatio(0n, 0n)).toMatchObject({ label: 'Fully covered', ratio: 1 });
    expect(calculateCoverageRatio(0n, 5000n)).toMatchObject({ label: '0.00%', ratio: 0 });
    expect(calculateCoverageRatio(9000n, 5000n)).toMatchObject({ label: '180.00%', ratio: 1.8 });
  });

  it('formats insurance share as a percentage of protocol supply', () => {
    expect(calculateInsuranceShare(2500n, 10000n)).toBe(2500n);
    expect(formatPercentFromBps(2500n)).toBe('25.00%');
    expect(formatPercentFromBps(0n)).toBe('0.00%');
  });

  it('rejects events when the split does not add up to the amount', () => {
    const valid = decodeBadDebtWriteOffEvent({ amount: 1000n, insurance_used: 600n, reserve_used: 300n, socialized: 100n });
    expect(valid).toMatchObject({ amount: 1000n, insuranceUsed: 600n, reserveUsed: 300n, socialized: 100n });

    const invalid = decodeBadDebtWriteOffEvent({ amount: 1000n, insurance_used: 600n, reserve_used: 250n, socialized: 100n });
    expect(invalid).toBeNull();
  });
});
