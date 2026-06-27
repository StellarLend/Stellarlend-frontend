import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf-token';

/**
 * Constant-time string comparison to avoid leaking token contents via
 * timing side-channels. `timingSafeEqual` requires equal-length buffers,
 * so unequal-length inputs are rejected before comparison (this length
 * check itself is not secret-dependent, so it doesn't reintroduce a
 * meaningful timing leak).
 */
function constantTimeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export function generateCsrfToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function setCsrfCookie(response: NextResponse, token: string) {
  const cookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  };
  response.cookies.set(CSRF_COOKIE_NAME, token, cookieOptions);
}

export function verifyCsrfToken(request: NextRequest): boolean {
  const authorizationHeader = request.headers.get('authorization');
  if (authorizationHeader?.startsWith('Bearer ')) {
    return true;
  }

  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME);
  const csrfHeader = request.headers.get('x-csrf-token');

  if (!csrfCookie?.value || !csrfHeader) {
    return false;
  }

  return constantTimeEqual(csrfCookie.value, csrfHeader);
}
