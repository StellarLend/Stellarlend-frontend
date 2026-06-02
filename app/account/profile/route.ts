import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateProfile } from "@/lib/account/validation";
import { profileRepository, ProfileRecord } from "@/lib/account/repository";
import { db } from "@/lib/db/client";
import { outboxEvents } from "@/lib/db/schema";
import { auditLogger } from "@/lib/audit-logger";
import crypto from "crypto";


export async function GET(req: NextRequest): Promise<NextResponse> {
    let user;
    try {
        user = requireAuth(req);
    } catch (res) {
        return res as NextResponse;
    }

    const profile = await profileRepository.getByUserId(user.id);


    return NextResponse.json(
        profile ?? {
            userId: user.id,
            displayName: "",
            bio: "",
            timezone: "UTC",
            updatedAt: null,
        }
    );
}


const putHandler = async (req: NextRequest): Promise<NextResponse> => {
    let user;
    try {
        user = requireAuth(req);
    } catch (res) {
        return res as NextResponse;
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateProfile(body);
    if (!validation.success) {
        return NextResponse.json({ errors: validation.errors }, { status: 422 });
    }

    const record = db.transaction((tx) => {
        // 1. Update the profile
        const updatedRecord = profileRepository.upsert(user.id, validation.data, tx) as ProfileRecord;

        // 2. Queue in-app notification event in the outbox
        tx.insert(outboxEvents).values({
            id: crypto.randomUUID(),
            type: 'notification',
            payload: JSON.stringify({
                userId: user.id,
                title: 'Profile Updated',
                message: 'Your profile has been successfully updated.',
                type: 'success',
            }),
            status: 'PENDING',
            attempts: 0,
            createdAt: new Date(),
        }).run();

        // 3. Queue audit log event in the outbox
        auditLogger.log(tx, user.id, 'profile_update', validation.data);

        return updatedRecord;
    });

    return NextResponse.json(record);
};

export const PUT = withCsrfProtection(putHandler);