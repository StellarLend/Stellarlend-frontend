import { sanitiseRecord, sanitiseString } from '../../lib/security/input-sanitizer';

describe('sanitiseString', () => {
  it('strips control and format characters', () => {
    expect(sanitiseString('Hello\u0007World')).toBe('HelloWorld');
    expect(sanitiseString('aB\u202EC')).toBe('aBC');
  });

  it('normalizes to NFC', () => {
    expect(sanitiseString('\u00E9\u006A')).toBe('\u00E9\u006A'.normalize('NFC'));
  });
});

describe('sanitiseRecord', () => {
  it('sanitises string fields while leaving non-string fields untouched', () => {
    const input = {
      name: 'Alice\u0000',
      age: 42,
      address: { city: 'New\u200B York', zip: '10001' },
      tags: ['a', 'b'],
      active: true,
    };

    const result = sanitiseRecord(input);

    expect(result.name).toBe('Alice');
    expect(result.age).toBe(42);
    expect(result.address).toEqual(input.address);
    expect(result.tags).toEqual(input.tags);
    expect(result.active).toBe(true);
  });

  it('returns an equivalent object for all-string records', () => {
    const input = { first: '\u200BJane', last: 'Doe\uFEFF' };
    const result = sanitiseRecord(input);

    expect(result).toEqual({ first: 'Jane', last: 'Doe' });
  });

  it('preserves numeric and object fields by reference', () => {
    const nested = { note: '\u200Bhi' };
    const input = { count: 0, nested };
    const result = sanitiseRecord(input);

    expect(result.count).toBe(0);
    expect(result.nested).toBe(nested);
  });
});
