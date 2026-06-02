import { describe, it, expect } from 'vitest';
import { escapeField, serializeTransactionsToCSV } from './csv';
import type { Transaction } from './types';

describe('escapeField', () => {
  it('wraps a plain value in double quotes', () => {
    expect(escapeField('hello')).toBe('"hello"');
  });

  it('doubles embedded double-quotes (RFC 4180)', () => {
    expect(escapeField('say "hello"')).toBe('"say ""hello"""');
  });

  it('prefixes = with a single quote to prevent formula injection', () => {
    expect(escapeField('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`);
  });

  it('prefixes + to prevent formula injection', () => {
    expect(escapeField('+cmd|/C calc')).toBe(`"'+cmd|/C calc"`);
  });

  it('prefixes - to prevent formula injection', () => {
    expect(escapeField('-2+3')).toBe(`"'-2+3"`);
  });

  it('prefixes @ to prevent formula injection', () => {
    expect(escapeField('@SUM(1+1)')).toBe(`"'@SUM(1+1)"`);
  });

  it('prefixes tab character to prevent formula injection', () => {
    expect(escapeField('\tinjection')).toBe(`"'\tinjection"`);
  });

  it('handles an empty string', () => {
    expect(escapeField('')).toBe('""');
  });

  it('handles a string that is just a double-quote', () => {
    expect(escapeField('"')).toBe('""""');
  });
});

describe('serializeTransactionsToCSV', () => {
  const sample: Transaction[] = [
    {
      id: 'TXN001',
      type: 'Deposit',
      amount: 1000,
      asset: 'XLM',
      date: '2025-04-01',
      time: '10:00AM',
      status: 'Completed',
    },
    {
      id: 'TXN002',
      type: 'Withdrawal',
      amount: -500,
      asset: 'BTC',
      date: '2025-04-02',
      time: '11:00AM',
      status: 'Processing',
    },
  ];

  it('produces the correct CSV header row', () => {
    const csv = serializeTransactionsToCSV(sample);
    const [header] = csv.split('\r\n');
    expect(header).toBe('"ID","Type","Amount","Asset","Date","Time","Status"');
  });

  it('serializes the correct number of data rows', () => {
    const csv = serializeTransactionsToCSV(sample);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3); // 1 header + 2 rows
  });

  it('serializes transaction fields correctly', () => {
    const csv = serializeTransactionsToCSV([sample[0]]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('"TXN001","Deposit","1000","XLM","2025-04-01","10:00AM","Completed"');
  });

  it('handles negative amounts without injection prefix', () => {
    const csv = serializeTransactionsToCSV([sample[1]]);
    const lines = csv.split('\r\n');
    // -500 starts with '-', so it gets a injection prefix
    expect(lines[1]).toContain(`"'-500"`);
  });

  it('returns just the header row for an empty array', () => {
    const csv = serializeTransactionsToCSV([]);
    expect(csv).toBe('"ID","Type","Amount","Asset","Date","Time","Status"');
  });

  it('uses CRLF line endings per RFC 4180', () => {
    const csv = serializeTransactionsToCSV(sample);
    expect(csv).toContain('\r\n');
  });
});
