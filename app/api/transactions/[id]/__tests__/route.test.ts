import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getTransactionDetail } from '@/lib/transactions/repository';

// Mock getTransactionDetail
vi.mock('@/lib/transactions/repository', () => ({
  getTransactionDetail: vi.fn(),
}));

const mockGetTransactionDetail = vi.mocked(getTransactionDetail);

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/transactions/[id] - Transaction Detail API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when the transaction ID shape is invalid', async () => {
    const req = new NextRequest('http://localhost/api/transactions/invalid-id');
    const res = await GET(req, makeParams('invalid-id'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid transaction ID format');
    expect(body.details).toContain('Invalid transaction ID format');
  });

  it('returns 404 when a valid ID shape is not found in the database', async () => {
    mockGetTransactionDetail.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/transactions/TXN99999');
    const res = await GET(req, makeParams('TXN99999'));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Transaction not found');
  });

  it('returns 200 and normalized transaction details with operations for a valid mock ID', async () => {
    const mockDetail = {
      id: 'TXN12345',
      type: 'Deposit',
      amount: 2000,
      asset: 'XLM' as const,
      date: '2025-04-12',
      time: '09:32AM',
      status: 'Completed' as const,
      fee: '0.0001000 XLM',
      explorerUrl: 'https://stellar.expert/explorer/testnet/tx/TXN12345',
      operations: [
        {
          id: 'op_TXN12345_1',
          type: 'payment',
          source: 'GA2C5RFPE6GCKMY3AA3H6AOF5Q4G5S4GX6TQCGEAAS624JBZ2G2UQHGD',
          destination: 'GBXQ2P5Z5U67G6Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66',
          amount: '2000.0000000',
          asset: 'XLM',
        },
      ],
    };

    mockGetTransactionDetail.mockResolvedValueOnce(mockDetail);

    const req = new NextRequest('http://localhost/api/transactions/TXN12345');
    const res = await GET(req, makeParams('TXN12345'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transaction).toEqual(mockDetail);
    expect(body.transaction.fee).toBe('0.0001000 XLM');
    expect(body.transaction.explorerUrl).toContain('stellar.expert');
    expect(body.transaction.operations).toHaveLength(1);
  });

  it('validates and accepts 64-character hexadecimal Soroban transaction hashes', async () => {
    const validHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd';
    const mockDetail = {
      id: validHash,
      type: 'Withdrawal',
      amount: -150,
      asset: 'USDC' as const,
      date: '2026-06-01',
      time: '12:00PM',
      status: 'Completed' as const,
      fee: '0.0001500 XLM',
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${validHash}`,
      operations: [
        {
          id: `op_${validHash}_1`,
          type: 'invoke_host_function',
          source: 'GA2C5RFPE6GCKMY3AA3H6AOF5Q4G5S4GX6TQCGEAAS624JBZ2G2UQHGD',
          destination: 'GBXQ2P5Z5U67G6Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66',
          amount: '150.0000000',
          asset: 'USDC',
        },
      ],
    };

    mockGetTransactionDetail.mockResolvedValueOnce(mockDetail);

    const req = new NextRequest(`http://localhost/api/transactions/${validHash}`);
    const res = await GET(req, makeParams(validHash));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transaction.id).toBe(validHash);
    expect(body.transaction.operations[0].type).toBe('invoke_host_function');
  });
});
