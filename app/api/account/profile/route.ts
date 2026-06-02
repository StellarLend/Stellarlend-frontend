import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { profileRepository } from '@/lib/account/repository';
import { validateProfile } from '@/lib/account/validation';
import { appendAuditEvent, hashIp } from '@/lib/audit/logger';

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