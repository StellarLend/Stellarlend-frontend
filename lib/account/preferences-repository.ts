export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface UserPreferences {
  userId: string;
  locale: string;
  displayCurrency: string;
  notifications: NotificationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type UpsertPreferencesInput = {
  userId: string;
  locale?: string;
  displayCurrency?: string;
  notifications?: Partial<NotificationSettings>;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  push: true,
  sms: false,
  inApp: true,
};

export class PreferencesRepository {
  private store = new Map<string, UserPreferences>();

  getByUserId(userId: string): UserPreferences | null {
    return this.store.get(userId) ?? null;
  }

  upsert(
    userIdOrInput: string | UpsertPreferencesInput,
    data?: Partial<UserPreferences>
  ): UserPreferences {
    const now = new Date();

    let userId: string;
    let inputData: Partial<UserPreferences>;

    if (typeof userIdOrInput === 'string') {
      userId = userIdOrInput;
      inputData = data ?? {};
    } else {
      userId = userIdOrInput.userId;
      inputData = userIdOrInput;
    }

    const existing = this.store.get(userId);

    const mergedNotifications: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(existing?.notifications ?? {}),
      ...(inputData.notifications ?? {}),
    };

    const record: UserPreferences = {
      userId,
      locale: inputData.locale ?? existing?.locale ?? 'en-US',
      displayCurrency: inputData.displayCurrency ?? existing?.displayCurrency ?? 'USD',
      notifications: mergedNotifications,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.store.set(userId, record);
    return record;
  }
}

export const preferencesRepository = new PreferencesRepository();
