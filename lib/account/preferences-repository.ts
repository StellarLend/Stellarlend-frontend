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
