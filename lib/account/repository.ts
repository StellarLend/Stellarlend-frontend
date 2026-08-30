import { db } from '@/lib/db/index';
import { accounts } from '@/lib/db/schema/accounts';
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
    getByUserId(userId: string, tx?: any): Promise<ProfileRecord | null>;

    upsert(
        userId: string,
        data: Omit<ProfileRecord, "userId" | "updatedAt">,
        tx?: any
    ): Promise<ProfileRecord>;
}

const ANONYMIZED_MARKER = '[deleted]';

class DrizzleProfileRepository implements ProfileRepository {
    async getByUserId(userId: string, tx?: any): Promise<ProfileRecord | null> {
        const client = tx || db;
        const [result] = await client
            .select()
            .from(accounts)
            .where(eq(accounts.userId, userId))
            .limit(1);
        return result ?? null;
    }

    async upsert(
        userId: string,
        data: Omit<ProfileRecord, "userId" | "updatedAt">,
        tx?: any
    ): Promise<ProfileRecord> {
        const client = tx || db;
        const [result] = await client
            .insert(accounts)
            .values({
                userId,
                ...data,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: accounts.userId,
                set: {
                    displayName: data.displayName,
                    bio: data.bio,
                    website: data.website,
                    timezone: data.timezone,
                    updatedAt: new Date(),
                },
            })
            .returning();
        return result;
    }

    async anonymizeByUserId(userId: string): Promise<boolean> {
        const existing = await this.getByUserId(userId);
        if (!existing) return false;

        await db
            .update(accounts)
            .set({
                displayName: ANONYMIZED_MARKER,
                bio: "",
                website: "",
                timezone: "UTC",
                updatedAt: new Date(),
            })
            .where(eq(accounts.userId, userId));
        return true;
    }
}

export const profileRepository: ProfileRepository =
    new DrizzleProfileRepository();