import { NextRequest } from 'next/server';
import { GET } from './route';
import { getUser } from '@/lib/auth';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

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
      walletAddress: 'GA-test-address',
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

    for (const pos of data.positions) {
      expect(pos).toHaveProperty('asset');
      expect(pos).toHaveProperty('borrowedAmount');
      expect(pos).toHaveProperty('collateralAsset');
      expect(pos).toHaveProperty('collateralAmount');
      expect(pos).toHaveProperty('collateralFactor');
      expect(pos).toHaveProperty('healthFactor');
      expect(pos).toHaveProperty('liquidationPriceFactor');
      expect(pos).toHaveProperty('riskScore');
      expect(pos.riskScore).toBeGreaterThanOrEqual(0);
      expect(pos.riskScore).toBeLessThanOrEqual(1);
    }
  });

  it('returns positions sorted by risk score descending', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: 'GA-test-address',
      createdAt: new Date(),
    });

    const response = await GET(mockRequest('http://localhost:3000/api/liquidations'));
    const data = await response.json();

    for (let i = 1; i < data.positions.length; i++) {
      expect(data.positions[i - 1].riskScore).toBeGreaterThanOrEqual(
        data.positions[i].riskScore,
      );
    }
  });

  it('accepts optional wallet query param', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: 'GA-test-address',
      createdAt: new Date(),
    });

    const response = await GET(
      mockRequest('http://localhost:3000/api/liquidations?wallet=GA-custom-address'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.positions.length).toBeGreaterThan(0);
  });

  it('returns 400 for invalid wallet param (too long)', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: 'GA-test-address',
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

  it('computes totalRiskScore as max position risk score', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: 'GA-test-address',
      createdAt: new Date(),
    });

    const response = await GET(mockRequest('http://localhost:3000/api/liquidations'));
    const data = await response.json();

    const maxRisk = Math.max(...data.positions.map((p: { riskScore: number }) => p.riskScore));
    expect(data.totalRiskScore).toBe(maxRisk);
  });
});
