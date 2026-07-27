// lib/account/preferences-repository.ts

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  loanAlerts: boolean;
  marketingEmails: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface UserPreferences {
  userId: string;
  email?: string;
  locale: string;
  displayCurrency: string;
  notifications: NotificationSettings & NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export type PreferencesRecord = UserPreferences;

/** Input type for creating/updating preferences (timestamps managed internally). */
export type UpsertPreferencesInput = {
  userId: string;
  locale: string;
  displayCurrency: string;
  notifications: NotificationSettings;
};

/**
 * Default notification settings — all alerts enabled, marketing emails disabled.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailNotifications: true,
  pushNotifications: true,
  loanAlerts: true,
  marketingEmails: false,
};

/**
 * In-memory preferences repository.
 *
 * Provides `getByUserId` and `upsert` operations for user preference records.
 * Each instance maintains its own isolated store, making it safe to instantiate
 * fresh copies in tests.
 */
export class PreferencesRepository {
  private store = new Map<string, UserPreferences>();

  /**
   * Retrieve preferences for a given user.
   * @returns The stored preferences, or `null` if no record exists.
   */
  getByUserId(userId: string): UserPreferences | null {
    return this.store.get(userId) ?? null;
  }

  /**
   * Insert or update preferences for a user.
   * Supports both overload signatures:
   * 1. upsert(input: UpsertPreferencesInput)
   * 2. upsert(userId: string, data: Omit<UserPreferences, 'userId' | 'createdAt' | 'updatedAt'>)
   */
  upsert(input: UpsertPreferencesInput): UserPreferences;
  upsert(userId: string, data: any): UserPreferences;
  upsert(
    first: string | UpsertPreferencesInput,
    second?: any
  ): UserPreferences {
    const now = new Date();
    let userId: string;
    let locale: string;
    let displayCurrency: string;
    let notifications: any;

    if (typeof first === 'string') {
      userId = first;
      locale = second.locale;
      displayCurrency = second.displayCurrency;
      notifications = second.notifications;
    } else {
      userId = first.userId;
      locale = first.locale;
      displayCurrency = first.displayCurrency;
      notifications = first.notifications;
    }

    const existing = this.store.get(userId);

    const record: UserPreferences = {
      userId,
      locale,
      displayCurrency,
      notifications: { ...notifications },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.store.set(userId, record);
    return record;
  }
}

export const preferencesRepository = new PreferencesRepository();
