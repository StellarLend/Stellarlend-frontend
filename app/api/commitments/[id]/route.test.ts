import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { POST } from './actions/route';
import { getUser } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

const mockGetUser = vi.mocked(getUser);

const borrowerWallet = 'G' + 'A'.repeat(55);
const lenderWallet = 'G' + 'B'.repeat(55);

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('commitment route security boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated user for GET detail requests', async () => {
    mockGetUser.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/commitments/valid-id');
    const res = await GET(req, makeParams('valid-id'));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('rejects invalid commitment ids before loading mock data', async () => {
    mockGetUser.mockResolvedValueOnce({ id: 'user-1', walletAddress: borrowerWallet } as any);

    const req = new NextRequest('http://localhost/api/commitments/../../admin');
    const res = await GET(req, makeParams('../../admin'));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid commitment id' });
  });

  it('forbids access when the authenticated wallet is not a party to the commitment', async () => {
    mockGetUser.mockResolvedValueOnce({ id: 'user-1', walletAddress: 'G' + 'C'.repeat(55) } as any);

    const req = new NextRequest('http://localhost/api/commitments/commitment-123');
    const res = await GET(req, makeParams('commitment-123'));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('requires the same commitment id in the action payload as the route id', async () => {
    mockGetUser.mockResolvedValueOnce({ id: 'user-1', walletAddress: borrowerWallet } as any);

    const req = new NextRequest('http://localhost/api/commitments/commitment-123/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'dispute', commitmentId: 'other-id' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req, makeParams('commitment-123'));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Commitment id mismatch' });
  });

  it('rejects malformed action payloads and unauthorized wallets', async () => {
    mockGetUser.mockResolvedValueOnce({ id: 'user-1', walletAddress: borrowerWallet } as any);

    const req = new NextRequest('http://localhost/api/commitments/commitment-123/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'dispute', commitmentId: 'commitment-123', metadata: 'not-an-object' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req, makeParams('commitment-123'));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid action payload' });
  });

  it('returns only safe commitment data for the authenticated wallet', async () => {
    mockGetUser.mockResolvedValueOnce({ id: 'user-1', walletAddress: borrowerWallet } as any);

    const req = new NextRequest('http://localhost/api/commitments/commitment-123');
    const res = await GET(req, makeParams('commitment-123'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.commitment.id).toBe('commitment-123');
    expect(data.commitment.borrower).toBe(borrowerWallet);
    expect(data.commitment.transactionHash).toMatch(/^[0-9a-fA-F]{64}$/);
  });
});
