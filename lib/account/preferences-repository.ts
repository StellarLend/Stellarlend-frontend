<<<<<<< HEAD
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface PreferencesRecord {
  userId: string;
  locale: string;
  displayCurrency: string;
  notifications: NotificationPreferences;
  updatedAt: Date;
}

export interface PreferencesRepository {
  getByUserId(userId: string): Promise<PreferencesRecord | null>;

  upsert(
    userId: string,
    data: Omit<PreferencesRecord, "userId" | "updatedAt">
  ): Promise<PreferencesRecord>;
}

class InMemoryPreferencesRepository implements PreferencesRepository {
  private store = new Map<string, PreferencesRecord>();

  async getByUserId(userId: string): Promise<PreferencesRecord | null> {
    return this.store.get(userId) ?? null;
  }

  async upsert(
    userId: string,
    data: Omit<PreferencesRecord, "userId" | "updatedAt">
  ): Promise<PreferencesRecord> {
    const record: PreferencesRecord = {
      userId,
      ...data,
      updatedAt: new Date(),
    };
    this.store.set(userId, record);
    return record;
  }
}

export const preferencesRepository: PreferencesRepository =
  new InMemoryPreferencesRepository();
=======
// lib/account/preferences-repository.ts

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  loanAlerts: boolean;
  marketingEmails: boolean;
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
      notifications: { ...input.notifications },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.store.set(input.userId, record);
    return record;
  }
}
>>>>>>> 542869e (#522 Add unit tests for lib/account/preferences-repository in-memory upsert and read)
