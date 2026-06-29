import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PreferencesRepository,
  DEFAULT_NOTIFICATION_SETTINGS,
  type UpsertPreferencesInput,
  type UserPreferences,
  type NotificationSettings,
} from './preferences-repository';

describe('PreferencesRepository', () => {
  let repo: PreferencesRepository;

  beforeEach(() => {
    // Fresh instance per test to guarantee isolation
    repo = new PreferencesRepository();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── getByUserId ──────────────────────────────────────────────────────

  describe('getByUserId', () => {
    it('returns null for an unknown user', () => {
      expect(repo.getByUserId('nonexistent-user')).toBeNull();
    });

    it('returns the stored record after upsert', () => {
      const input: UpsertPreferencesInput = {
        userId: 'user-1',
        locale: 'en-US',
        displayCurrency: 'USD',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      };

      repo.upsert(input);
      const result = repo.getByUserId('user-1');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-1');
      expect(result!.locale).toBe('en-US');
      expect(result!.displayCurrency).toBe('USD');
    });
  });

  // ── upsert: insert behaviour ─────────────────────────────────────────

  describe('upsert – insert (first call)', () => {
    it('inserts a new record and returns it', () => {
      const input: UpsertPreferencesInput = {
        userId: 'user-new',
        locale: 'fr-FR',
        displayCurrency: 'EUR',
        notifications: {
          emailNotifications: false,
          pushNotifications: true,
          loanAlerts: true,
          marketingEmails: false,
        },
      };

      const result = repo.upsert(input);

      expect(result.userId).toBe('user-new');
      expect(result.locale).toBe('fr-FR');
      expect(result.displayCurrency).toBe('EUR');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('sets createdAt equal to updatedAt on first insert', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

      const result = repo.upsert({
        userId: 'user-ts',
        locale: 'en-US',
        displayCurrency: 'USD',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      });

      expect(result.createdAt.getTime()).toBe(result.updatedAt.getTime());
      expect(result.createdAt).toEqual(new Date('2025-06-01T12:00:00Z'));
    });
  });

  // ── upsert: update behaviour ─────────────────────────────────────────

  describe('upsert – update (subsequent calls)', () => {
    it('updates an existing record and refreshes updatedAt', () => {
      vi.useFakeTimers();
      const t1 = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(t1);

      repo.upsert({
        userId: 'user-upd',
        locale: 'en-US',
        displayCurrency: 'USD',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      });

      const t2 = new Date('2025-06-01T00:00:00Z');
      vi.setSystemTime(t2);

      const updated = repo.upsert({
        userId: 'user-upd',
        locale: 'de-DE',
        displayCurrency: 'EUR',
        notifications: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          marketingEmails: true,
        },
      });

      // Data is updated
      expect(updated.locale).toBe('de-DE');
      expect(updated.displayCurrency).toBe('EUR');
      expect(updated.notifications.marketingEmails).toBe(true);

      // createdAt preserved, updatedAt refreshed
      expect(updated.createdAt).toEqual(t1);
      expect(updated.updatedAt).toEqual(t2);
    });

    it('preserves createdAt across multiple updates', () => {
      vi.useFakeTimers();
      const origin = new Date('2024-01-01T00:00:00Z');
      vi.setSystemTime(origin);

      repo.upsert({
        userId: 'user-multi',
        locale: 'en-US',
        displayCurrency: 'USD',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      });

      // Perform several updates
      for (let i = 1; i <= 5; i++) {
        vi.setSystemTime(new Date(`2024-0${i + 1}-01T00:00:00Z`));
        repo.upsert({
          userId: 'user-multi',
          locale: `locale-${i}`,
          displayCurrency: 'USD',
          notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
        });
      }

      const final = repo.getByUserId('user-multi')!;
      expect(final.createdAt).toEqual(origin);
      expect(final.locale).toBe('locale-5');
    });
  });

  // ── updatedAt monotonicity ───────────────────────────────────────────

  describe('updatedAt monotonicity', () => {
    it('updatedAt never decreases across sequential upserts', () => {
      vi.useFakeTimers();
      const timestamps: Date[] = [];

      for (let i = 0; i < 5; i++) {
        const t = new Date(Date.now() + i * 1000);
        vi.setSystemTime(t);

        repo.upsert({
          userId: 'user-mono',
          locale: 'en-US',
          displayCurrency: 'USD',
          notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
        });

        const record = repo.getByUserId('user-mono')!;
        timestamps.push(record.updatedAt);
      }

      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i].getTime()).toBeGreaterThanOrEqual(
          timestamps[i - 1].getTime(),
        );
      }
    });
  });

  // ── User isolation ──────────────────────────────────────────────────

  describe('isolation across users', () => {
    it('records for different users do not collide', () => {
      const inputA: UpsertPreferencesInput = {
        userId: 'alice',
        locale: 'en-GB',
        displayCurrency: 'GBP',
        notifications: {
          emailNotifications: true,
          pushNotifications: false,
          loanAlerts: true,
          marketingEmails: false,
        },
      };

      const inputB: UpsertPreferencesInput = {
        userId: 'bob',
        locale: 'ja-JP',
        displayCurrency: 'JPY',
        notifications: {
          emailNotifications: false,
          pushNotifications: true,
          loanAlerts: false,
          marketingEmails: true,
        },
      };

      repo.upsert(inputA);
      repo.upsert(inputB);

      const alice = repo.getByUserId('alice')!;
      const bob = repo.getByUserId('bob')!;

      // Alice's data is intact
      expect(alice.locale).toBe('en-GB');
      expect(alice.displayCurrency).toBe('GBP');
      expect(alice.notifications.pushNotifications).toBe(false);

      // Bob's data is intact
      expect(bob.locale).toBe('ja-JP');
      expect(bob.displayCurrency).toBe('JPY');
      expect(bob.notifications.emailNotifications).toBe(false);
      expect(bob.notifications.marketingEmails).toBe(true);
    });

    it('updating one user does not affect another', () => {
      repo.upsert({
        userId: 'charlie',
        locale: 'en-US',
        displayCurrency: 'USD',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      });
      repo.upsert({
        userId: 'diana',
        locale: 'pt-BR',
        displayCurrency: 'BRL',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      });

      // Update charlie
      repo.upsert({
        userId: 'charlie',
        locale: 'es-MX',
        displayCurrency: 'MXN',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS, loanAlerts: false },
      });

      // Diana unchanged
      const diana = repo.getByUserId('diana')!;
      expect(diana.locale).toBe('pt-BR');
      expect(diana.displayCurrency).toBe('BRL');
      expect(diana.notifications.loanAlerts).toBe(true);
    });
  });

  // ── Stored record shape ─────────────────────────────────────────────

  describe('stored record shape', () => {
    it('preserves locale, displayCurrency, and notifications shape', () => {
      const notifications: NotificationSettings = {
        emailNotifications: true,
        pushNotifications: false,
        loanAlerts: true,
        marketingEmails: false,
        liquidationAlerts: ['liquidation:XLM:USDC'],
      };

      const input: UpsertPreferencesInput = {
        userId: 'shape-user',
        locale: 'ko-KR',
        displayCurrency: 'KRW',
        notifications,
      };

      repo.upsert(input);
      const stored = repo.getByUserId('shape-user')!;

      expect(stored).toMatchObject({
        userId: 'shape-user',
        locale: 'ko-KR',
        displayCurrency: 'KRW',
        notifications: {
          emailNotifications: true,
          pushNotifications: false,
          loanAlerts: true,
          marketingEmails: false,
          liquidationAlerts: ['liquidation:XLM:USDC'],
        },
      });

      // Verify the exact keys on the notifications object
      expect(Object.keys(stored.notifications).sort()).toEqual([
        'emailNotifications',
        'liquidationAlerts',
        'loanAlerts',
        'marketingEmails',
        'pushNotifications',
      ]);
    });

    it('stores a defensive copy of the notifications object', () => {
      const notifications: NotificationSettings = {
        emailNotifications: true,
        pushNotifications: true,
        loanAlerts: true,
        marketingEmails: false,
        liquidationAlerts: [],
      };

      const input: UpsertPreferencesInput = {
        userId: 'copy-user',
        locale: 'en-US',
        displayCurrency: 'USD',
        notifications,
      };

      repo.upsert(input);

      // Mutate the original input – the stored record should be unaffected
      notifications.marketingEmails = true;

      const stored = repo.getByUserId('copy-user')!;
      expect(stored.notifications.marketingEmails).toBe(false);
    });
  });

  // ── Default notification toggles ────────────────────────────────────

  describe('default notification toggles', () => {
    it('DEFAULT_NOTIFICATION_SETTINGS has expected default values', () => {
      expect(DEFAULT_NOTIFICATION_SETTINGS).toEqual({
        emailNotifications: true,
        pushNotifications: true,
        loanAlerts: true,
        marketingEmails: false,
        liquidationAlerts: [],
      });
    });

    it('can upsert with default notification settings', () => {
      repo.upsert({
        userId: 'default-user',
        locale: 'en-US',
        displayCurrency: 'USD',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      });

      const stored = repo.getByUserId('default-user')!;
      expect(stored.notifications.emailNotifications).toBe(true);
      expect(stored.notifications.pushNotifications).toBe(true);
      expect(stored.notifications.loanAlerts).toBe(true);
      expect(stored.notifications.marketingEmails).toBe(false);
    });
  });

  // ── Fresh instance isolation (repository state reset) ───────────────

  describe('fresh instance isolation', () => {
    it('a new PreferencesRepository instance has no data', () => {
      repo.upsert({
        userId: 'leftover-user',
        locale: 'en-US',
        displayCurrency: 'USD',
        notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
      });

      // Simulate a "reset" by creating a new instance
      const freshRepo = new PreferencesRepository();
      expect(freshRepo.getByUserId('leftover-user')).toBeNull();
    });
  });
});
