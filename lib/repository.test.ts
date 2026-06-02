import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPreference, updatePreference, fanOutNotification } from './repository';

const limitMock = vi.fn();
const onConflictDoUpdateMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: limitMock
        }))
      }))
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        onConflictDoUpdate: onConflictDoUpdateMock
      }))
    }))
  }
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn()
}));

vi.mock('@/lib/db/schema', () => ({
  notificationPreferences: {
    userId: 'userId',
    channel: 'channel',
    eventType: 'eventType',
    enabled: 'enabled'
  }
}));

describe('Notifications Repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPreference', () => {
    it('returns true for default policy (non-marketing)', async () => {
      limitMock.mockResolvedValueOnce([]);
      const result = await getPreference('user-1', 'email', 'deposit');
      expect(result).toBe(true);
    });

    it('returns false for default policy (marketing)', async () => {
      limitMock.mockResolvedValueOnce([]);
      const result = await getPreference('user-1', 'email', 'marketing');
      expect(result).toBe(false);
    });

    it('returns database value if preference exists', async () => {
      limitMock.mockResolvedValueOnce([{ enabled: false }]);
      const result = await getPreference('user-1', 'email', 'deposit');
      expect(result).toBe(false);
    });
  });

  describe('updatePreference', () => {
    it('calls db insert with correct values', async () => {
      onConflictDoUpdateMock.mockResolvedValueOnce([{ userId: 'user-1' }]);
      await updatePreference('user-1', 'sms', 'liquidation_warning', false);
      expect(onConflictDoUpdateMock).toHaveBeenCalled();
    });
  });

  describe('fanOutNotification', () => {
    it('sends notification to channels that are enabled and injects optOutUrl for email', async () => {
      limitMock.mockResolvedValueOnce([{ enabled: true }]);
      limitMock.mockResolvedValueOnce([{ enabled: false }]);

      const payload = { amount: 100 };
      const sent = await fanOutNotification('user-1', 'deposit', payload, ['email', 'sms']);
      
      expect(sent).toEqual(['email']);
      expect(payload).toHaveProperty('optOutUrl');
    });

    it('skips all channels if all are opted out', async () => {
      limitMock.mockResolvedValueOnce([{ enabled: false }]);
      limitMock.mockResolvedValueOnce([{ enabled: false }]);

      const sent = await fanOutNotification('user-1', 'marketing', {}, ['email', 'sms']);
      expect(sent).toEqual([]);
    });
  });
});