import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import config from '@/lib/config';
import { createDeletionChallenge } from '@/lib/account/challenge-store';
import { emitAuditEvent } from '@/lib/audit/events';
import { accountBucketRateLimit } from '@/lib/rate-limit/account-bucket';
import { withRequestLogging } from '@/lib/api/handler';

const ROUTE = '/api/account/delete/challenge';

export async function GET(req: NextRequest) {
  return withRequestLogging(ROUTE, async () => {
    const user = requireAuth(req);
    if (user instanceof NextResponse) return user;

    const accountLimit = accountBucketRateLimit(user.id, config.rateLimit.account);
    if (!accountLimit.success) {
      emitAuditEvent('auth.challenge.rate_limited', user.id, {
        challengeType: 'account_deletion',
        retryAfter: accountLimit.retryAfter,
      });

      const response = NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Account deletion challenge rate limit exceeded. Please try again later.',
            limit: accountLimit.limit,
            remaining: accountLimit.remaining,
            reset: accountLimit.reset,
            retryAfter: accountLimit.retryAfter,
          },
        },
        { status: 429 },
      );

      response.headers.set('X-RateLimit-Limit', accountLimit.limit.toString());
      response.headers.set('X-RateLimit-Remaining', accountLimit.remaining.toString());
      response.headers.set('X-RateLimit-Reset', accountLimit.reset.toString());
      response.headers.set('Retry-After', accountLimit.retryAfter.toString());
      return response;
    }

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
