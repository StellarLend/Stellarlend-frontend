import { db } from '../db';
import { accounts } from '../db/schema/accounts';
import { eq } from 'drizzle-orm';

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

    anonymizeByUserId(userId: string): Promise<boolean>;
}

const ANONYMIZED_MARKER = "[deleted]";

class InMemoryProfileRepository implements ProfileRepository {
    private store = new Map<string, ProfileRecord>();

    async getByUserId(userId: string): Promise<ProfileRecord | null> {
        const rows = await db.select().from(accounts).where(eq(accounts.userId, userId)).limit(1);
        return rows[0] ?? null;
    }

    async upsert(
        userId: string,
        data: Omit<ProfileRecord, "userId" | "updatedAt">
    ): Promise<ProfileRecord> {
        const now = new Date();
        const record = {
            userId,
            displayName: data.displayName,
            bio: data.bio,
            website: data.website,
            timezone: data.timezone,
            updatedAt: now,
        };

        await db.insert(accounts)
            .values(record)
            .onConflictDoUpdate({
                target: accounts.userId,
                set: {
                    displayName: data.displayName,
                    bio: data.bio,
                    website: data.website,
                    timezone: data.timezone,
                    updatedAt: now,
                },
            });

        return record;
    }

    async anonymizeByUserId(userId: string): Promise<boolean> {
        const existing = this.store.get(userId);
        if (!existing) return false;

        const anonymized: ProfileRecord = {
            userId: existing.userId,
            displayName: ANONYMIZED_MARKER,
            bio: "",
            website: "",
            timezone: "UTC",
            updatedAt: new Date(),
        };
        this.store.set(userId, anonymized);
        return true;
    }
}

export const profileRepository: ProfileRepository =
    new DrizzleProfileRepository();