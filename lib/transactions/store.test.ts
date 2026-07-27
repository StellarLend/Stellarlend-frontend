import { describe, it, expect } from 'vitest';
import { mapTransactionRow } from './store';

describe('mapTransactionRow', () => {
  it('maps a valid transaction row successfully', () => {
    const row = {
      id: 'TXN12345',
      type: 'Deposit',
      amount: 2000,
      asset: 'XLM',
      date: '2025-04-12',
      time: '09:32AM',
      status: 'Completed',
    };

    const transaction = mapTransactionRow(row);

    expect(transaction).toEqual({
      id: 'TXN12345',
      type: 'Deposit',
      amount: 2000,
      asset: 'XLM',
      date: '2025-04-12',
      time: '09:32AM',
      status: 'Completed',
    });
  });

  it('throws when asset is invalid', () => {
    const row = {
      id: 'TXN12346',
      type: 'Withdrawal',
      amount: -7500,
      asset: 'INVALID_ASSET',
      date: '2025-02-28',
      time: '04:45PM',
      status: 'Completed',
    };

    expect(() => mapTransactionRow(row)).toThrow(
      'Invalid transaction asset: INVALID_ASSET',
    );
  });

  it('throws when status is invalid', () => {
    const row = {
      id: 'TXN12347',
      type: 'Loan Payment',
      amount: -250,
      asset: 'BTC',
      date: '2025-03-10',
      time: '11:15AM',
      status: 'INVALID_STATUS',
    };

    expect(() => mapTransactionRow(row)).toThrow(
      'Invalid transaction status: INVALID_STATUS',
    );
  });
});
