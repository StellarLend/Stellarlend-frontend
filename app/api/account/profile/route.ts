import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth, getAuthUser } from '@/lib/auth';
import { profileRepository, ProfileRecord } from '@/lib/account/repository';
import { validateProfile } from '@/lib/account/validation';
import { appendAuditEvent, hashIp } from '@/lib/audit/logger';
import { withCsrfProtection } from "@/lib/api/handler";
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

    const updatedRecord = await profileRepository.upsert(user.id, validation.data);

    db.transaction((tx) => {
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

        auditLogger.log(tx, user.id, 'profile_update', validation.data);
    });

    return NextResponse.json(updatedRecord);
};

export const PUT = withCsrfProtection(putHandler);

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id');
  const ipHash = hashIp(request.headers.get('x-forwarded-for'));

  try {
    const session = await getSession();
    const actorWallet = session?.user?.walletAddress;

    if (!actorWallet) {
      await appendAuditEvent({
        actorWallet: null,
        action: 'profile.update',
        resource: 'account.profile',
        status: 'failure',
        requestId,
        ipHash,
      });

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = validateProfile(body);

    if (!result.success) {
      await appendAuditEvent({
        actorWallet,
        action: 'profile.update',
        resource: 'account.profile',
        status: 'failure',
        requestId,
        ipHash,
      });

      return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
    }

    const profile = await profileRepository.upsert(actorWallet, result.data);

    await appendAuditEvent({
      actorWallet,
      action: 'profile.update',
      resource: 'account.profile',
      status: 'success',
      requestId,
      ipHash,
    });

    return NextResponse.json({ profile });
  } catch {
    await appendAuditEvent({
      actorWallet: null,
      action: 'profile.update',
      resource: 'account.profile',
      status: 'failure',
      requestId,
      ipHash,
    });

    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}