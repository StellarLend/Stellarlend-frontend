import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verifyDeletionChallenge } from '@/lib/account/challenge-store';
import { deleteAccount } from '@/lib/account/delete';
import { withRequestLogging } from '@/lib/api/handler';

const ROUTE = '/api/account/delete';

export async function DELETE(req: NextRequest) {
  return withRequestLogging(ROUTE, async () => {
    const user = requireAuth(req);
    if (user instanceof NextResponse) return user;

    let body: { challenge?: string } | undefined;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!body?.challenge) {
      return NextResponse.json(
        { error: 'Missing deletion challenge. Request one from /api/account/delete/challenge first.' },
        { status: 400 }
      );
    }

    const valid = verifyDeletionChallenge(body.challenge, user.id);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or expired deletion challenge' },
        { status: 401 }
      );
    }

    try {
      const result = await deleteAccount(user.id);
      return NextResponse.json(
        {
          message: 'Account deletion initiated',
          anonymizedAt: result.anonymizedAt,
          notificationsRemoved: result.notificationsRemoved,
          cleanupJobsEnqueued: result.cleanupJobsEnqueued.length,
        },
        { status: 200 }
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Account deletion failed' },
        { status: 500 }
      );
    }
  })();
}
