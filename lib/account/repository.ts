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
            .from(profiles)
            .where(eq(profiles.userId, userId))
            .limit(1);
        return result ?? null;
    }

    upsert(
        userId: string,
        data: Omit<ProfileRecord, "userId" | "updatedAt">,
        tx?: any
    ): Promise<ProfileRecord> | ProfileRecord {
        if (tx) {
            const existing = tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1).get?.() ?? null;
            const updatedAt = new Date();

            if (existing) {
                tx
                    .update(profiles)
                    .set({
                        displayName: data.displayName,
                        bio: data.bio,
                        website: data.website,
                        timezone: data.timezone,
                        updatedAt,
                    })
                    .where(eq(profiles.userId, userId))
                    .run();

                return {
                    userId,
                    ...data,
                    updatedAt,
                } as ProfileRecord;
            }

            tx.insert(profiles).values({
                userId,
                ...data,
                updatedAt,
            }).run();

            return {
                userId,
                ...data,
                updatedAt,
            } as ProfileRecord;
        }

        return (async () => {
            const client = db;
            const [result] = await client
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
            return result;
        })();
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