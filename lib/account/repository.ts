import { db } from '@/lib/db/client';
import { profiles } from '@/lib/db/schema';
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
    getByUserId(userId: string, tx?: any): ProfileRecord | null | Promise<ProfileRecord | null>;

    upsert(
        userId: string,
        data: Omit<ProfileRecord, "userId" | "updatedAt">,
        tx?: any
    ): ProfileRecord | Promise<ProfileRecord>;
}

const ANONYMIZED_MARKER = '[deleted]';

class DrizzleProfileRepository implements ProfileRepository {
    getByUserId(userId: string, tx?: any): ProfileRecord | null | Promise<ProfileRecord | null> {
        const client = tx || db;
        const query = client
            .select()
            .from(profiles)
            .where(eq(profiles.userId, userId))
            .limit(1);

        if (tx) {
            const results = query.all();
            return results[0] ?? null;
        } else {
            return query.then((results: any[]) => results[0] ?? null);
        }
    }

    upsert(
        userId: string,
        data: Omit<ProfileRecord, "userId" | "updatedAt">,
        tx?: any
    ): ProfileRecord | Promise<ProfileRecord> {
        const client = tx || db;
        const query = client
            .insert(profiles)
            .values({
                userId,
                ...data,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: profiles.userId,
                set: {
                    displayName: data.displayName,
                    bio: data.bio,
                    website: data.website,
                    timezone: data.timezone,
                    updatedAt: new Date(),
                },
            })
            .returning();

        if (tx) {
            const results = query.all();
            return results[0];
        } else {
            return query.then((results: any[]) => results[0]);
        }
    }

    async anonymizeByUserId(userId: string): Promise<boolean> {
        const existing = await this.getByUserId(userId);
        if (!existing) return false;

        await db
            .update(profiles)
            .set({
                displayName: ANONYMIZED_MARKER,
                bio: "",
                website: "",
                timezone: "UTC",
                updatedAt: new Date(),
            })
            .where(eq(profiles.userId, userId));
        return true;
    }
}

export const profileRepository: ProfileRepository =
    new DrizzleProfileRepository();