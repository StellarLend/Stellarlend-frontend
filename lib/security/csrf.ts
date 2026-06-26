import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'csrf-token';

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

function constantTimeTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
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

  return constantTimeTokenEqual(csrfCookie.value, csrfHeader);
}
