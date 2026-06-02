import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/markets/registry', () => ({
  getMarket: vi.fn().mockImplementation((marketId) => (
    marketId === 'xlm' ? { id: 'xlm', feeSchedule: { lendFeeBps: 10, borrowFeeBps: 20, repayFeeBps: 5, minFeeAmount: 0.1 } } : undefined
  ))
}));

describe('GET /api/quote', () => {
  it('returns quote with protocol fees included', async () => {
    const req = new Request('http://localhost/api/quote?marketId=xlm&action=borrow&amount=1000');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.quote.protocolFee.feeAmount).toBe(2);
    expect(data.quote.note).toContain('Protocol fees take precedence');
  });
});