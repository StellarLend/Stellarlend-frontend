import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flattenSearchResults, getResultByIndex, getResultsCount } from './useSearchResults';
import type { GroupedSearchResults } from './types';

// Mock transaction data
const mockTransaction = {
  id: 'TXN123',
  type: 'transaction' as const,
  title: 'Deposit - XLM',
  subtitle: '1000 XLM • 2025-06-27',
  transaction: {
    id: 'TXN123',
    type: 'Deposit' as const,
    amount: 1000,
    asset: 'XLM' as const,
    date: '2025-06-27',
    time: '10:00AM',
    status: 'Completed' as const,
  },
};

const mockPosition = {
  id: 'pos-xlm-1',
  type: 'position' as const,
  title: 'XLM Position',
  subtitle: 'Balance: $5,000.00',
  asset: 'XLM',
};

describe('Search Utilities', () => {
  describe('flattenSearchResults', () => {
    it('should flatten empty grouped results', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(0);
    });

    it('should flatten transactions only', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(1);
      expect(flattened[0].type).toBe('transaction');
    });

    it('should flatten positions only', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [mockPosition],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(1);
      expect(flattened[0].type).toBe('position');
    });

    it('should flatten mixed transactions and positions', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [mockPosition],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(2);
      expect(flattened[0].type).toBe('transaction');
      expect(flattened[1].type).toBe('position');
    });

    it('should preserve order with multiple results', () => {
      const tx2 = { ...mockTransaction, id: 'TXN124' };
      const pos2 = { ...mockPosition, id: 'pos-usdc-1' };

      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction, tx2],
        positions: [mockPosition, pos2],
      };

      const flattened = flattenSearchResults(grouped);
      expect(flattened).toHaveLength(4);
      expect(flattened[0].id).toBe('TXN123');
      expect(flattened[1].id).toBe('TXN124');
      expect(flattened[2].id).toBe('pos-xlm-1');
      expect(flattened[3].id).toBe('pos-usdc-1');
    });
  });

  describe('getResultByIndex', () => {
    it('should return undefined for empty results', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [],
      };

      const result = getResultByIndex(grouped, 0);
      expect(result).toBeUndefined();
    });

    it('should return first result', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [],
      };

      const result = getResultByIndex(grouped, 0);
      expect(result).toBeDefined();
      expect(result?.id).toBe('TXN123');
    });

    it('should return result by index', () => {
      const tx2 = { ...mockTransaction, id: 'TXN124' };
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction, tx2],
        positions: [mockPosition],
      };

      const result0 = getResultByIndex(grouped, 0);
      const result1 = getResultByIndex(grouped, 1);
      const result2 = getResultByIndex(grouped, 2);

      expect(result0?.id).toBe('TXN123');
      expect(result1?.id).toBe('TXN124');
      expect(result2?.id).toBe('pos-xlm-1');
    });

    it('should return undefined for out of bounds index', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [],
      };

      const result = getResultByIndex(grouped, 100);
      expect(result).toBeUndefined();
    });

    it('should return undefined for negative index', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction],
        positions: [],
      };

      const result = getResultByIndex(grouped, -1);
      expect(result).toBeUndefined();
    });
  });

  describe('getResultsCount', () => {
    it('should return 0 for empty results', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [],
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(0);
    });

    it('should count only transactions', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
        positions: [],
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(2);
    });

    it('should count only positions', () => {
      const grouped: GroupedSearchResults = {
        transactions: [],
        positions: [mockPosition, { ...mockPosition, id: 'pos-usdc-1' }],
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(2);
    });

    it('should count mixed results', () => {
      const grouped: GroupedSearchResults = {
        transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
        positions: [mockPosition, { ...mockPosition, id: 'pos-usdc-1' }],
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(4);
    });

    it('should count large result sets', () => {
      const grouped: GroupedSearchResults = {
        transactions: Array.from({ length: 50 }, (_, i) => ({
          ...mockTransaction,
          id: `TXN${i}`,
        })),
        positions: Array.from({ length: 30 }, (_, i) => ({
          ...mockPosition,
          id: `pos-${i}`,
        })),
      };

      const count = getResultsCount(grouped);
      expect(count).toBe(80);
    });
  });
});
