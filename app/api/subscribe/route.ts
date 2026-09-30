import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { subscribers } from '@/lib/db/schema';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

const ROUTE = '/api/subscribe';
/** 5 subscription attempts per IP per 10 minutes */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * POST /api/subscribe
 *
 * Body: { email: string }
 *
 * 200 – subscribed successfully
 * 409 – email already subscribed
 * 422 – missing or invalid email
 * 429 – rate limit exceeded
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const limiter = rateLimit(`subscribe:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!limiter.success) {
    const retryAfterSec = Math.ceil((limiter.reset - Date.now()) / 1000);
    logger.warn('Subscribe rate limit exceeded', ROUTE, { ip });
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'RateLimit-Limit': String(limiter.limit),
          'RateLimit-Remaining': String(limiter.remaining),
          'RateLimit-Reset': String(Math.ceil(limiter.reset / 1000)),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON.' } },
      { status: 422 },
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Request body must be a JSON object.' } },
      { status: 422 },
    );
  }

  const { email } = body as Record<string, unknown>;

  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json(
      { error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.' } },
      { status: 422 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_RE.test(normalizedEmail)) {
    return NextResponse.json(
      { error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.' } },
      { status: 422 },
    );
  }

  // Check for duplicate before inserting to surface a clear 409 rather than a DB error
  const existing = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(eq(subscribers.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    logger.info('Subscribe duplicate attempt', ROUTE, { email: normalizedEmail });
    return NextResponse.json(
      { error: { code: 'ALREADY_SUBSCRIBED', message: 'This email is already subscribed.' } },
      { status: 409 },
    );
  }

  await db.insert(subscribers).values({
    email: normalizedEmail,
    subscribedAt: new Date(),
  });

  logger.info('New subscriber', ROUTE, { email: normalizedEmail });
  return NextResponse.json({ message: 'Subscribed successfully.' }, { status: 200 });
}
