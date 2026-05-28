
export interface ProfileRecord {
    userId: string;
    displayName: string;
    bio: string;
    website: string;
    timezone: string;
    updatedAt: Date;
}

export interface ProfileRepository {
    getByUserId(userId: string): Promise<ProfileRecord | null>;

    upsert(
        userId: string,
        data: Omit<ProfileRecord, "userId" | "updatedAt">
    ): Promise<ProfileRecord>;
}

class InMemoryProfileRepository implements ProfileRepository {
    private store = new Map<string, ProfileRecord>();

    async getByUserId(userId: string): Promise<ProfileRecord | null> {
        return this.store.get(userId) ?? null;
    }

    async upsert(
        userId: string,
        data: Omit<ProfileRecord, "userId" | "updatedAt">
    ): Promise<ProfileRecord> {
        const record: ProfileRecord = {
            userId,
            ...data,
            updatedAt: new Date(),
        };
        this.store.set(userId, record);
        return record;
    }
}

export const profileRepository: ProfileRepository =
    new InMemoryProfileRepository();