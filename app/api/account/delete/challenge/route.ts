import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createDeletionChallenge } from '@/lib/account/challenge-store';
import { emitAuditEvent } from '@/lib/audit/events';
import { withRequestLogging } from '@/lib/api/handler';

const ROUTE = '/api/account/delete/challenge';

export async function GET(req: NextRequest) {
  return withRequestLogging(ROUTE, async () => {
    const user = requireAuth(req);
    if (user instanceof NextResponse) return user;

    const challenge = createDeletionChallenge(user.id);

    emitAuditEvent('auth.challenge.issued', user.id, {
      challengeType: 'account_deletion',
    });

    return NextResponse.json({
      challenge: challenge.challenge,
      expiresAt: challenge.expiresAt.toISOString(),
      message: 'Sign this challenge with your wallet to confirm account deletion',
    });
  })();
}
