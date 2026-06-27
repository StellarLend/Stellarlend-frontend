import { describe, it, expect } from 'vitest';
import { escapeCsvField, transactionsToCsv } from '@/lib/transactions/csv';
import { Transaction } from '@/lib/transactions/repository';

describe('escapeCsvField', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
    expect(escapeCsvField('USDC')).toBe('USDC');
  });

  it('wraps field containing a comma in double-quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('doubles embedded double-quotes', () => {
    const input = 'say "hello"';
    const expected = '"say ""hello"""';
    expect(escapeCsvField(input)).toBe(expected);
  });

  it('prevents CSV injection: wraps fields starting with =', () => {
    expect(escapeCsvField('=CMD|...')).toBe('"=CMD|..."');
  });

  it('prevents CSV injection: wraps fields starting with +', () => {
    expect(escapeCsvField('+1234')).toBe('"+1234"');
  });

  it('prevents CSV injection: wraps fields starting with -', () => {
    expect(escapeCsvField('-1234')).toBe('"-1234"');
  });

  it('prevents CSV injection: wraps fields starting with @', () => {
    expect(escapeCsvField('@SUM(1+1)')).toBe('"@SUM(1+1)"');
  });

  it('wraps fields containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('\"line1\nline2\"');
  });
});

describe('transactionsToCsv', () => {
  const TX: Transaction = {
    id: 'tx-001',
    userId: 'user-1',
    type: 'lend',
    amount: 500,
    asset: 'USDC',
    status: 'completed',
    timestamp: '2025-01-10T10:00:00Z',
    txHash: '0xabc1',
  };

  it('produces a header row as the first line', () => {
    const csv = transactionsToCsv([TX]);
    const [header] = csv.split('\n');
    expect(header).toBe('id,userId,type,amount,asset,status,timestamp,txHash');
  });

  it('produces one data row per transaction', () => {
    const csv = transactionsToCsv([TX, { ...TX, id: 'tx-002' }]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
  });

  it('returns only the header for an empty list', () => {
    const csv = transactionsToCsv([]);
    expect(csv).toBe('id,userId,type,amount,asset,status,timestamp,txHash');
  });

  it('handles missing optional fields gracefully', () => {
    const { txHash: _, ...txNoHash } = TX;
    const csv = transactionsToCsv([txNoHash as Transaction]);
    const dataRow = csv.split('\n')[1];
    expect(dataRow.endsWith(',')).toBe(true);
  });

  it('escapes injection payloads in transaction fields', () => {
    const malicious: Transaction = { ...TX, asset: '=malicious()' };
    const csv = transactionsToCsv([malicious]);
    expect(csv).toContain('"=malicious()"');
  });
});
