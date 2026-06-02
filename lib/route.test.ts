import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from './route';
import { updatePreference } from '@/lib/notifications/repository';
import { getUser } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn()
}));

vi.mock('@/lib/notifications/repository', () => ({
  updatePreference: vi.fn().mockResolvedValue(true)
}));

describe('PATCH /api/account/notification-preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates preferences successfully', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ name: 'Guest' });
    
    const req = new Request('http://localhost/api/account/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        preferences: [
          { channel: 'email', eventType: 'marketing', enabled: false },
          { channel: 'sms', eventType: 'liquidation_warning', enabled: true }
        ]
      })
    });
    
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.message).toBe('Preferences updated successfully');
    expect(data.preferences.length).toBe(2);
    expect(updatePreference).toHaveBeenCalledTimes(2);
    expect(updatePreference).toHaveBeenCalledWith('Guest', 'email', 'marketing', false);
  });

  it('returns 401 if user is not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null as any);
    
    const req = new Request('http://localhost/api/account/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences: [] })
    });
    
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-array payload', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ name: 'Guest' });
    const req = new Request('http://localhost/api/account/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences: 'invalid' })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid preference object', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ name: 'Guest' });
    const req = new Request('http://localhost/api/account/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences: [{ channel: 'email' }] }) // Missing required properties
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 when repository throws an error', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ name: 'Guest' });
    vi.mocked(updatePreference).mockRejectedValueOnce(new Error('DB Error'));
    const req = new Request('http://localhost/api/account/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences: [{ channel: 'email', eventType: 'system', enabled: true }] })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
  });
});