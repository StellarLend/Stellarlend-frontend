import { NextRequest } from 'next/server';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/lib/api/handler', () => ({
  withRequestLogging: (_route: string, handler: Function) => handler,
}));

vi.mock('@/lib/positions/liquidation', () => ({
  generateMockPositions: vi.fn(() => [
    {
      asset: 'USDC',
      borrowedAmount: 1000,
      collateralAsset: 'XLM',
      collateralAmount: 5000,
      collateralFactor: 0.8,
      healthFactor: 2.5,
      liquidationPriceFactor: 0.4,
      riskScore: 0.3,
    },
  ]),
  computeLiquidations: vi.fn((positions: any[]) =>
    positions.map((p) => ({ ...p, riskScore: p.riskScore })),
  ),
}));

vi.mock('@/lib/validation/stellar', () => ({
  isAccountId: vi.fn((addr: string) => /^G[A-Z2-7]{55}$/.test(addr)),
}));

import { GET } from './route';
import { getUser } from '@/lib/auth';

// 56-char valid Stellar address format
const VALID_WALLET = 'G' + 'A'.repeat(55);

function mockRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe('GET /api/liquidations', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const response = await GET(mockRequest('http://localhost:3000/api/liquidations'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns liquidation positions when authenticated', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: VALID_WALLET,
      createdAt: new Date(),
    });

    const response = await GET(mockRequest('http://localhost:3000/api/liquidations'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('positions');
    expect(data).toHaveProperty('totalRiskScore');
    expect(data).toHaveProperty('timestamp');
    expect(Array.isArray(data.positions)).toBe(true);
    expect(data.positions.length).toBeGreaterThan(0);
  });

  it('returns 400 for invalid wallet param (too long)', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: VALID_WALLET,
      createdAt: new Date(),
    });

    const longWallet = 'G' + 'A'.repeat(60);
    const response = await GET(
      mockRequest(`http://localhost:3000/api/liquidations?wallet=${longWallet}`),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid wallet address');
  });

  it('returns 400 for non-Stellar wallet address', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: VALID_WALLET,
      createdAt: new Date(),
    });

    const response = await GET(
      mockRequest('http://localhost:3000/api/liquidations?wallet=invalid-wallet-123'),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid wallet address');
    expect(data.details).toBeDefined();
  });

  it('returns 400 for empty wallet param', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: VALID_WALLET,
      createdAt: new Date(),
    });

    const response = await GET(
      mockRequest('http://localhost:3000/api/liquidations?wallet='),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid wallet address');
  });

  it('accepts valid wallet query param', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: VALID_WALLET,
      createdAt: new Date(),
    });

    const response = await GET(
      mockRequest(`http://localhost:3000/api/liquidations?wallet=${VALID_WALLET}`),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.positions.length).toBeGreaterThan(0);
  });

  it('uses fallback address when user has no walletAddress', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
    });

    const response = await GET(mockRequest('http://localhost:3000/api/liquidations'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.positions.length).toBeGreaterThan(0);
  });
});