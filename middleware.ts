import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import appConfig from '@/lib/config';
import { getOrCreateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

// Mutating HTTP methods that change server/on-chain state and must carry an
// idempotency key so retries and refreshes can't duplicate the operation.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Routes exempt from the idempotency requirement (session management,
// health checks, and other naturally-idempotent server ops).
const IDEMPOTENCY_EXEMPT = [
  '/api/health',
  '/api/auth/session',
  '/api/auth/logout',
];

function generateNonce(): string {
  const array = new Uint8Array(16);
  (globalThis.crypto || crypto).getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

function sanitizeCookieName(value: string | undefined): string {
  const normalized = (value ?? 'session').trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(normalized)) {
    return 'session';
  }
  return normalized;
}

function getSafeClientIp(request: NextRequest): string {
  const rawIp =
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1';

  const firstCandidate = rawIp
    .split(',')[0]
    .trim()
    .replace(/\[|\]|\s+/g, '');

  if (!firstCandidate || firstCandidate === 'unknown') {
    return '127.0.0.1';
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(firstCandidate)) {
    const octets = firstCandidate.split('.');
    const valid = octets.every((octet) => {
      const value = Number(octet);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
    return valid ? firstCandidate : '127.0.0.1';
  }

  if (/^[0-9A-Fa-f:.]+$/.test(firstCandidate) && firstCandidate.includes(':')) {
    return firstCandidate;
  }

  return '127.0.0.1';
}

function getRequestIdHeaders(request: NextRequest) {
  const { requestId } = getOrCreateRequestId(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  // Generate CSP nonce per request
  const nonce = generateNonce();
  requestHeaders.set('x-csp-nonce', nonce);

  return { requestId, requestHeaders, nonce };
}

function setRequestIdHeader(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function requiresIdempotencyKey(request: NextRequest): boolean {
  if (!MUTATING_METHODS.has(request.method)) return false;
  const { pathname } = request.nextUrl;
  return !IDEMPOTENCY_EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function applySecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}';`);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const safePathname = pathname.startsWith('/') ? pathname : `/${pathname}`;

  // 1. Path Filter: Only apply to API routes
  if (!safePathname.startsWith('/api')) {
    // For non‑API routes, still set CSP header with nonce for inline scripts
    const nonce = generateNonce();
    const response = NextResponse.next();
    applySecurityHeaders(response, nonce);
    response.headers.set('x-csp-nonce', nonce);
    return response;
  }

  const { requestId, requestHeaders, nonce } = getRequestIdHeaders(request);

  // 2. Exemption: Health checks should never be rate limited
  if (safePathname === '/api/health') {
    const response = setRequestIdHeader(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
    applySecurityHeaders(response, nonce);
    return response;
  }

  // 3. Exemption: Authenticated internal calls
  const sessionCookieName = sanitizeCookieName(
    appConfig.rateLimit ? process.env.NEXT_PUBLIC_SESSION_COOKIE : undefined,
  );
  const isAuth = request.cookies.has(sessionCookieName);

  if (isAuth) {
    const response = setRequestIdHeader(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
    applySecurityHeaders(response, nonce);
    return response;
  }

  // 4. Identification (IP-based for anonymous requests)
  const ip = getSafeClientIp(request);
  const identifier = `api-ratelimit:${ip}`;

  const { success, limit, remaining, reset } = rateLimit(
    identifier,
    appConfig.rateLimit.max,
    appConfig.rateLimit.window
  );

  // 6. Prepare Response
  let response: NextResponse;

  if (success) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    response = new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  applySecurityHeaders(response, nonce);

  // 7. Standard Rate Limit Headers
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.floor(reset / 1000).toString());

  if (!success) {
    // Clamp to 0 so clients never see a negative Retry-After when the window
    // resets between the rateLimit() call and the header write.
    const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return setRequestIdHeader(response, requestId);
}

export const config = {
  matcher: '/api/:path*',
};
