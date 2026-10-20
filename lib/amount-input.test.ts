import { describe, expect, it } from 'vitest';
import { normaliseAmountInput } from './amount-input';

describe('normaliseAmountInput', () => {
  it('normalises en-US input', () => {
    expect(normaliseAmountInput('1,234.56', 'en')).toBe('1234.56');
    expect(normaliseAmountInput('1.000', 'en')).toBe('1');
    expect(normaliseAmountInput('1,5', 'en')).toBeNull();
  });

  it('normalises es-ES input', () => {
    expect(normaliseAmountInput('1.234,56', 'es')).toBe('1234.56');
    expect(normaliseAmountInput('1,5', 'es')).toBe('1.5');
    expect(normaliseAmountInput(' 1.234 ', 'es')).toBe('1234');
  });

  it('rejects malformed and ambiguous values', () => {
    expect(normaliseAmountInput('1,2,3', 'es')).toBeNull();
    expect(normaliseAmountInput('1.2.3', 'en')).toBeNull();
    expect(normaliseAmountInput('1,', 'en')).toBeNull();
    expect(normaliseAmountInput('1.', 'es')).toBeNull();
  });
});
