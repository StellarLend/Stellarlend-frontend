// lib/account/preferences-repository.ts

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  loanAlerts: boolean;
  marketingEmails: boolean;
  liquidationAlerts: string[];
}

export interface UserPreferences {
  userId: string;
  locale: string;
  displayCurrency: string;
  notifications: NotificationSettings;
  createdAt: Date;
  updatedAt: Date;
}

/** Input type for creating/updating preferences (timestamps managed internally). */
export type UpsertPreferencesInput = {
  userId: string;
  locale: string;
  displayCurrency: string;
  notifications?: Partial<NotificationSettings>;
};

/**
 * Default notification settings — all alerts enabled, marketing emails disabled.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailNotifications: true,
  pushNotifications: true,
  loanAlerts: true,
  marketingEmails: false,
  liquidationAlerts: [],
};

export function normalizeNotificationSettings(
  notifications?: Partial<NotificationSettings> | null,
): NotificationSettings {
  const liquidationAlerts = Array.isArray(notifications?.liquidationAlerts)
    ? Array.from(new Set(notifications.liquidationAlerts)).filter(
        (alertKey): alertKey is string => typeof alertKey === 'string',
      )
    : [];

  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...notifications,
    liquidationAlerts,
  };
}

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
   *
   * - On first call for a userId, creates a new record with `createdAt` and `updatedAt` set to now.
   * - On subsequent calls, updates the record while preserving the original `createdAt` and refreshing `updatedAt`.
   */
  upsert(input: UpsertPreferencesInput): UserPreferences {
    const now = new Date();
    const existing = this.store.get(input.userId);

    const record: UserPreferences = {
      userId: input.userId,
      locale: input.locale,
      displayCurrency: input.displayCurrency,
      notifications: normalizeNotificationSettings(input.notifications),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.store.set(input.userId, record);
    return record;
  }
}
