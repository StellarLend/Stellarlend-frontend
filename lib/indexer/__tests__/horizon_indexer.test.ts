import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HorizonIndexer, HorizonOperation } from '../horizon';
import {
  clearMemoRegistry,
  registerAccountMemo,
  deriveAndRegisterMemo,
} from '../../stellar/memo';

// Mock the cursor module
vi.mock('../cursor', () => {
  let mockCursor = '100';
  return {
    getLatestCursor: vi.fn(async (indexerId: string) => mockCursor),
    saveCursorCheckpoint: vi.fn(async (indexerId: string, cursor: string) => {
      mockCursor = cursor;
    }),
  };
});

describe('HorizonIndexer - Memo Validation & Strict Mode', () => {
  const indexerId = 'shared-deposit-indexer';
  const sharedAddress = 'G-SHARED-ADDRESS';
  const userAccount = 'G-USER-ACCOUNT';
  let indexer: HorizonIndexer;

  beforeEach(() => {
    clearMemoRegistry();
    vi.stubEnv('STRICT_MEMO_MODE', 'false');
    vi.stubEnv('MEMO_SALT', 'test-salt');
    indexer = new HorizonIndexer(indexerId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('processes operations successfully when there are no memos', async () => {
    const operations: HorizonOperation[] = [
      { id: '1', paging_token: '101', type: 'payment', transaction_successful: true },
      { id: '2', paging_token: '102', type: 'payment', transaction_successful: true },
    ];

    const mockFetcher = vi.fn(async (cursor: string | null) => operations);

    const processedCount = await indexer.fetchAndProcessBatch(mockFetcher);
    expect(processedCount).toBe(2);
    expect(mockFetcher).toHaveBeenCalledWith('100');
  });

  it('returns 0 when no operations are fetched', async () => {
    const mockFetcher = vi.fn(async (cursor: string | null) => []);
    const processedCount = await indexer.fetchAndProcessBatch(mockFetcher);
    expect(processedCount).toBe(0);
  });

  it('processes operations with valid registered memos normally', async () => {
    // Register the user's memo
    const memo = deriveAndRegisterMemo(userAccount, 'MEMO_ID');

    const operations: HorizonOperation[] = [
      {
        id: '1',
        paging_token: '101',
        type: 'payment',
        transaction_successful: true,
        memo: memo.value,
        memo_type: memo.type,
      },
    ];

    const mockFetcher = vi.fn(async (cursor: string | null) => operations);
    const processedCount = await indexer.fetchAndProcessBatch(mockFetcher);

    expect(processedCount).toBe(1);
  });

  it('filters out operations with unknown memos in non-strict mode', async () => {
    const operations: HorizonOperation[] = [
      {
        id: '1',
        paging_token: '101',
        type: 'payment',
        transaction_successful: true,
        memo: '999999', // Unknown MEMO_ID
        memo_type: 'MEMO_ID',
      },
      {
        id: '2',
        paging_token: '102',
        type: 'payment',
        transaction_successful: true,
      },
    ];

    const mockFetcher = vi.fn(async (cursor: string | null) => operations);
    const processedCount = await indexer.fetchAndProcessBatch(mockFetcher);

    // In non-strict mode, operation 1 is skipped, operation 2 is kept.
    expect(processedCount).toBe(1);
  });

  it('filters out operations with malformed memos in non-strict mode', async () => {
    const operations: HorizonOperation[] = [
      {
        id: '1',
        paging_token: '101',
        type: 'payment',
        transaction_successful: true,
        memo: 'not-hex', // Malformed HASH
        memo_type: 'MEMO_HASH',
      },
    ];

    const mockFetcher = vi.fn(async (cursor: string | null) => operations);
    const processedCount = await indexer.fetchAndProcessBatch(mockFetcher);

    // Malformed HASH is skipped
    expect(processedCount).toBe(0);
  });

  it('throws an error (rejects) when an unknown memo is encountered in strict mode', async () => {
    vi.stubEnv('STRICT_MEMO_MODE', 'true');

    const operations: HorizonOperation[] = [
      {
        id: '1',
        paging_token: '101',
        type: 'payment',
        transaction_successful: true,
        memo: '999999',
        memo_type: 'MEMO_ID',
      },
    ];

    const mockFetcher = vi.fn(async (cursor: string | null) => operations);

    await expect(indexer.fetchAndProcessBatch(mockFetcher)).rejects.toThrow(
      'Strict Mode Rejection: Operation 1 has unknown memo "999999"'
    );
  });

  it('throws an error (rejects) when a malformed memo is encountered in strict mode', async () => {
    vi.stubEnv('STRICT_MEMO_MODE', 'true');

    const operations: HorizonOperation[] = [
      {
        id: '1',
        paging_token: '101',
        type: 'payment',
        transaction_successful: true,
        memo: 'invalid-id-value',
        memo_type: 'MEMO_ID',
      },
    ];

    const mockFetcher = vi.fn(async (cursor: string | null) => operations);

    await expect(indexer.fetchAndProcessBatch(mockFetcher)).rejects.toThrow(
      'Strict Mode Rejection: Operation 1 has invalid memo "invalid-id-value" of type "MEMO_ID"'
    );
  });

  it('throws an error (rejects) when an inbound payment is missing a memo in strict mode', async () => {
    vi.stubEnv('STRICT_MEMO_MODE', 'true');

    const operations: HorizonOperation[] = [
      {
        id: '1',
        paging_token: '101',
        type: 'payment', // payment type implies inbound transfer
        transaction_successful: true,
      },
    ];

    const mockFetcher = vi.fn(async (cursor: string | null) => operations);

    await expect(indexer.fetchAndProcessBatch(mockFetcher)).rejects.toThrow(
      'Strict Mode Rejection: Inbound operation 1 has no memo'
    );
  });

  it('throws an error (rejects) when other inbound operation types lack a memo in strict mode', async () => {
    vi.stubEnv('STRICT_MEMO_MODE', 'true');

    const createAccountOp: HorizonOperation = {
      id: '2',
      paging_token: '102',
      type: 'create_account',
      transaction_successful: true,
    };

    const mockFetcher = vi.fn(async (cursor: string | null) => [createAccountOp]);
    await expect(indexer.fetchAndProcessBatch(mockFetcher)).rejects.toThrow(
      'Strict Mode Rejection: Inbound operation 2 has no memo'
    );
  });
});
