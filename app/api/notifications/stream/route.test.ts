import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));
import { getUser } from '@/lib/auth';
const mockGetUser = vi.mocked(getUser);

describe('GET /api/notifications/stream', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue(null as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns a text/event-stream response when authenticated', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-test-1' } as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const ct = res.headers.get('Content-Type') || res.headers.get('content-type');
    expect(ct).toMatch(/text\/event-stream/i);
  });
});
