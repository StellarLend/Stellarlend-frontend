import { describe, expect, it } from 'vitest';
import { formatCurrency } from './format';

describe('formatCurrency', () => {
  describe('NaN handling', () => {
    it('returns empty string for NaN', () => {
      expect(formatCurrency(NaN)).toBe('');
    });
  });

  describe('thousands grouping', () => {
    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('0.00');
    });

    it('formats sub-1000 values without separator', () => {
      expect(formatCurrency(999)).toBe('999.00');
    });

    it('formats sub-1000 decimal values', () => {
      expect(formatCurrency(0.5)).toBe('0.50');
    });

    it('inserts one separator for thousands', () => {
      expect(formatCurrency(1000)).toBe('1,000.00');
    });

    it('inserts one separator for thousands with decimals', () => {
      expect(formatCurrency(1234.56)).toBe('1,234.56');
    });

    it('inserts two separators for millions', () => {
      expect(formatCurrency(1234567)).toBe('1,234,567.00');
    });

    it('inserts two separators for millions with decimals', () => {
      expect(formatCurrency(1234567.5)).toBe('1,234,567.50');
    });

    it('formats exact thousand boundary', () => {
      expect(formatCurrency(1000000)).toBe('1,000,000.00');
    });

    it('formats large numbers with multiple separators', () => {
      expect(formatCurrency(123456789)).toBe('123,456,789.00');
    });

    it('formats billions', () => {
      expect(formatCurrency(1000000000)).toBe('1,000,000,000.00');
    });
  });

  describe('negative values', () => {
    it('keeps the sign for small negatives', () => {
      expect(formatCurrency(-1)).toBe('-1.00');
    });

    it('keeps the sign and groups correctly', () => {
      expect(formatCurrency(-5000)).toBe('-5,000.00');
    });

    it('formats large negative numbers with grouping', () => {
      expect(formatCurrency(-1234567.89)).toBe('-1,234,567.89');
    });
  });

  describe('precision', () => {
    it('defaults to 2 decimal places', () => {
      expect(formatCurrency(1.5)).toBe('1.50');
    });

    it('uses custom precision: 0', () => {
      expect(formatCurrency(123.456, 0)).toBe('123');
    });

    it('uses custom precision: 4', () => {
      expect(formatCurrency(1.234567, 4)).toBe('1.2346');
    });

    it('rounds up with custom precision', () => {
      expect(formatCurrency(1.9999, 2)).toBe('2.00');
    });

    it('rounds down with custom precision', () => {
      expect(formatCurrency(1.1111, 2)).toBe('1.11');
    });

    it('groups correctly with precision: 0', () => {
      expect(formatCurrency(1234567, 0)).toBe('1,234,567');
    });

    it('groups correctly with precision: 4', () => {
      expect(formatCurrency(1234567.89, 4)).toBe('1,234,567.8900');
    });
  });

  describe('edge cases', () => {
    it('handles very small positive numbers', () => {
      expect(formatCurrency(0.0001, 4)).toBe('0.0001');
    });

    it('handles negative zero', () => {
      expect(formatCurrency(-0, 2)).toBe('0.00');
    });

    it('handles whole numbers with trailing zeros', () => {
      expect(formatCurrency(42, 4)).toBe('42.0000');
    });
  });
});
