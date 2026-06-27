import { describe, it, expect } from 'vitest';
import { normalizeOperation, normalizeOperations } from './normalizer';
import type { HorizonOperation } from './types';

const ACCOUNT_ID = 'GBXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890ABCDEF';
const OTHER_ACCOUNT_ID = 'GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890ABCDEF';

function makeOp(overrides: Partial<HorizonOperation> = {}): HorizonOperation {
  return {
    id: 'op-12345',
    type: 'payment',
    created_at: '2026-06-27T10:30:00Z',
    transaction_successful: true,
    from: OTHER_ACCOUNT_ID,
    to: ACCOUNT_ID,
    amount: '100.5000000',
    asset_type: 'native',
    ...overrides,
  };
}

describe('normalizeOperation', () => {
  describe('Asset Resolution', () => {
    it('resolves native asset to XLM', () => {
      const op = makeOp({ asset_type: 'native', asset_code: undefined });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.asset).toBe('XLM');
    });

    it('resolves recognized asset codes to AssetSymbol (uppercase)', () => {
      const op = makeOp({ asset_type: 'credit_alphanum4', asset_code: 'USDC' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.asset).toBe('USDC');
    });

    it('resolves lowercase asset codes and uppercases them', () => {
      const op = makeOp({ asset_type: 'credit_alphanum4', asset_code: 'usdc' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.asset).toBe('USDC');
    });

    it('returns null for unrecognized asset codes', () => {
      const op = makeOp({ asset_type: 'credit_alphanum4', asset_code: 'EUR' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });

    it('returns null for missing non-native asset codes', () => {
      const op = makeOp({ asset_type: 'credit_alphanum4', asset_code: undefined });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });
  });

  describe('Amount Parsing', () => {
    it('parses valid positive amount correctly', () => {
      const op = makeOp({ amount: '123.456' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.amount).toBe(123.456);
    });

    it('returns null for missing amount', () => {
      const op = makeOp({ amount: undefined });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });

    it('returns null for null amount string', () => {
      // @ts-expect-error - testing raw null payload
      const op = makeOp({ amount: null });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });

    it('returns null for invalid non-numeric amount string', () => {
      const op = makeOp({ amount: 'not-a-number' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });

    it('returns null for zero amount', () => {
      const op = makeOp({ amount: '0' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });
  });

  describe('UTC Date and Time Formatting', () => {
    it('parses the ISO date part (YYYY-MM-DD)', () => {
      const op = makeOp({ created_at: '2026-06-27T08:15:30Z' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.date).toBe('2026-06-27');
    });

    it('handles midnight (00:00) as 12:00AM', () => {
      const op = makeOp({ created_at: '2026-06-27T00:00:00Z' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.time).toBe('12:00AM');
    });

    it('handles noon (12:00) as 12:00PM', () => {
      const op = makeOp({ created_at: '2026-06-27T12:00:00Z' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.time).toBe('12:00PM');
    });

    it('handles morning time (e.g. 05:07) as 05:07AM', () => {
      const op = makeOp({ created_at: '2026-06-27T05:07:00Z' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.time).toBe('05:07AM');
    });

    it('handles PM time (e.g. 13:45) as 01:45PM', () => {
      const op = makeOp({ created_at: '2026-06-27T13:45:00Z' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.time).toBe('01:45PM');
    });

    it('handles late PM time (e.g. 23:59) as 11:59PM', () => {
      const op = makeOp({ created_at: '2026-06-27T23:59:59Z' });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).not.toBeNull();
      expect(tx!.time).toBe('11:59PM');
    });
  });

  describe('Operation Type: payment', () => {
    it('normalizes incoming payment to a Deposit with positive amount', () => {
      const op = makeOp({
        id: 'op-pay-inc',
        type: 'payment',
        from: OTHER_ACCOUNT_ID,
        to: ACCOUNT_ID,
        amount: '500.0000000',
        asset_type: 'native',
        created_at: '2026-06-27T14:25:00Z',
        transaction_successful: true,
      });

      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toEqual({
        id: 'op-pay-inc',
        type: 'Deposit',
        amount: 500,
        asset: 'XLM',
        date: '2026-06-27',
        time: '02:25PM',
        status: 'Completed',
      });
    });

    it('normalizes outgoing payment to a Withdrawal with negative amount', () => {
      const op = makeOp({
        id: 'op-pay-out',
        type: 'payment',
        from: ACCOUNT_ID,
        to: OTHER_ACCOUNT_ID,
        amount: '250.7500000',
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        created_at: '2026-06-27T20:05:00Z',
        transaction_successful: false,
      });

      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toEqual({
        id: 'op-pay-out',
        type: 'Withdrawal',
        amount: -250.75,
        asset: 'USDC',
        date: '2026-06-27',
        time: '08:05PM',
        status: 'Failed',
      });
    });
  });

  describe('Operation Type: create_account', () => {
    it('normalizes incoming create_account to a Deposit in XLM', () => {
      const op = makeOp({
        id: 'op-ca-inc',
        type: 'create_account',
        account: ACCOUNT_ID,
        funder: OTHER_ACCOUNT_ID,
        starting_balance: '15.5000000',
        amount: undefined,
        from: undefined,
        to: undefined,
        asset_type: undefined,
      });

      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toEqual({
        id: 'op-ca-inc',
        type: 'Deposit',
        amount: 15.5,
        asset: 'XLM',
        date: '2026-06-27',
        time: '10:30AM',
        status: 'Completed',
      });
    });

    it('normalizes outgoing create_account to a Withdrawal in XLM', () => {
      const op = makeOp({
        id: 'op-ca-out',
        type: 'create_account',
        account: OTHER_ACCOUNT_ID,
        funder: ACCOUNT_ID,
        starting_balance: '30.0000000',
        amount: undefined,
        from: undefined,
        to: undefined,
        asset_type: undefined,
      });

      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toEqual({
        id: 'op-ca-out',
        type: 'Withdrawal',
        amount: -30,
        asset: 'XLM',
        date: '2026-06-27',
        time: '10:30AM',
        status: 'Completed',
      });
    });

    it('returns null for create_account with missing starting_balance', () => {
      const op = makeOp({
        type: 'create_account',
        account: ACCOUNT_ID,
        starting_balance: undefined,
      });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });

    it('returns null for create_account with zero starting_balance', () => {
      const op = makeOp({
        type: 'create_account',
        account: ACCOUNT_ID,
        starting_balance: '0',
      });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });
  });

  describe('Operation Type: path_payment_strict_send & path_payment_strict_receive', () => {
    it('normalizes incoming path_payment using destination asset and amount', () => {
      const op = makeOp({
        id: 'op-pp-inc',
        type: 'path_payment_strict_receive',
        to: ACCOUNT_ID,
        from: OTHER_ACCOUNT_ID,
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        destination_amount: '99.9',
        amount: '100.0', // fallback amount
        source_asset_type: 'native',
        source_amount: '120.0',
      });

      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toEqual({
        id: 'op-pp-inc',
        type: 'Deposit',
        amount: 99.9,
        asset: 'USDC',
        date: '2026-06-27',
        time: '10:30AM',
        status: 'Completed',
      });
    });

    it('normalizes incoming path_payment falling back to amount field when destination_amount is missing', () => {
      const op = makeOp({
        id: 'op-pp-inc-fallback',
        type: 'path_payment_strict_send',
        to: ACCOUNT_ID,
        from: OTHER_ACCOUNT_ID,
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        destination_amount: undefined,
        amount: '88.8',
        source_asset_type: 'native',
        source_amount: '110.0',
      });

      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toEqual({
        id: 'op-pp-inc-fallback',
        type: 'Deposit',
        amount: 88.8,
        asset: 'USDC',
        date: '2026-06-27',
        time: '10:30AM',
        status: 'Completed',
      });
    });

    it('normalizes outgoing path_payment using source asset and amount', () => {
      const op = makeOp({
        id: 'op-pp-out',
        type: 'path_payment_strict_send',
        to: OTHER_ACCOUNT_ID,
        from: ACCOUNT_ID,
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        destination_amount: '99.9',
        source_asset_type: 'native',
        source_amount: '125.5',
        amount: '130.0', // fallback amount
      });

      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toEqual({
        id: 'op-pp-out',
        type: 'Withdrawal',
        amount: -125.5,
        asset: 'XLM',
        date: '2026-06-27',
        time: '10:30AM',
        status: 'Completed',
      });
    });

    it('normalizes outgoing path_payment falling back to amount field when source_amount is missing', () => {
      const op = makeOp({
        id: 'op-pp-out-fallback',
        type: 'path_payment_strict_receive',
        to: OTHER_ACCOUNT_ID,
        from: ACCOUNT_ID,
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        destination_amount: '99.9',
        source_asset_type: 'credit_alphanum4',
        source_asset_code: 'ETH',
        source_amount: undefined,
        amount: '1.5',
      });

      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toEqual({
        id: 'op-pp-out-fallback',
        type: 'Withdrawal',
        amount: -1.5,
        asset: 'ETH',
        date: '2026-06-27',
        time: '10:30AM',
        status: 'Completed',
      });
    });

    it('returns null if path_payment resolves to an invalid asset', () => {
      const op = makeOp({
        type: 'path_payment_strict_send',
        to: ACCOUNT_ID,
        asset_type: 'credit_alphanum4',
        asset_code: 'EUR',
      });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });

    it('returns null if path_payment amount parses to null/0', () => {
      const op = makeOp({
        type: 'path_payment_strict_send',
        to: ACCOUNT_ID,
        asset_type: 'native',
        amount: '0.000',
      });
      const tx = normalizeOperation(op, ACCOUNT_ID);
      expect(tx).toBeNull();
    });
  });

  describe('Other/Unsupported Operations', () => {
    it('returns null for unsupported operation types', () => {
      const unsupportedTypes: HorizonOperation['type'][] = [
        'manage_sell_offer',
        'create_passive_sell_offer',
        'set_options',
        'change_trust',
        'allow_trust',
        'account_merge',
        'manage_data',
        'bump_sequence',
        'manage_buy_offer',
        'create_claimable_balance',
        'claim_claimable_balance',
      ];

      for (const type of unsupportedTypes) {
        const op = makeOp({ type });
        expect(normalizeOperation(op, ACCOUNT_ID)).toBeNull();
      }
    });
  });
});

describe('normalizeOperations', () => {
  it('normalizes multiple operations and filters out null results', () => {
    const ops: HorizonOperation[] = [
      makeOp({ id: 'op-1', to: ACCOUNT_ID, amount: '10' }),
      makeOp({ id: 'op-2', type: 'change_trust' }),
      makeOp({ id: 'op-3', to: ACCOUNT_ID, amount: '20' }),
    ];

    const result = normalizeOperations(ops, ACCOUNT_ID);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('op-1');
    expect(result[0].amount).toBe(10);
    expect(result[1].id).toBe('op-3');
    expect(result[1].amount).toBe(20);
  });

  it('returns empty array when given an empty list', () => {
    const result = normalizeOperations([], ACCOUNT_ID);
    expect(result).toEqual([]);
  });

  it('returns empty array when none of the operations are supported', () => {
    const ops = [
      makeOp({ type: 'change_trust' }),
      makeOp({ type: 'set_options' }),
    ];
    const result = normalizeOperations(ops, ACCOUNT_ID);
    expect(result).toEqual([]);
  });
});
