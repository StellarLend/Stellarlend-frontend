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

// Performance bounds for middleware execution
const MAX_HEADER_SIZE = 8192; // 8KB header limit
const MAX_COOKIE_SIZE = 4096; // 4KB per cookie
const MAX_PATH_LENGTH = 2048; // Max URL path length

// Telemetry for operational visibility
interface MiddlewareTelemetry {
  requestId: string;
  path: string;
  method: string;
  rateLimitApplied: boolean;
  rateLimitExceeded: boolean;
  securityHeadersApplied: boolean;
  durationMs: number;
  error?: string;
}

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

  // Bound: Truncate excessively long header values
  const truncated = rawIp.substring(0, 256);
  
  const firstCandidate = truncated
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
  // Bound: Ensure nonce length is within safe bounds (base64 encoded 16 bytes = ~24 chars)
  const safeNonce = nonce.substring(0, 64);
  
  response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${safeNonce}';`);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
}

function logTelemetry(telemetry: MiddlewareTelemetry): void {
  // Operational visibility: Log structured diagnostics without secrets
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware Telemetry]', JSON.stringify({
      requestId: telemetry.requestId,
      path: telemetry.path.substring(0, 100), // Truncate long paths
      method: telemetry.method,
      rateLimitApplied: telemetry.rateLimitApplied,
      rateLimitExceeded: telemetry.rateLimitExceeded,
      securityHeadersApplied: telemetry.securityHeadersApplied,
      durationMs: telemetry.durationMs,
      error: telemetry.error,
    }));
  }
}

export function middleware(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = request.nextUrl;
  
  // Bound: Enforce max path length
  if (pathname.length > MAX_PATH_LENGTH) {
    const response = new NextResponse(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Request path too long',
      }),
      { status: 414, headers: { 'Content-Type': 'application/json' } }
    );
    return response;
  }
  
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

  const telemetry: MiddlewareTelemetry = {
    requestId,
    path: safePathname,
    method: request.method,
    rateLimitApplied: false,
    rateLimitExceeded: false,
    securityHeadersApplied: true,
    durationMs: 0,
  };

  // 2. Exemption: Health checks should never be rate limited
  if (safePathname === '/api/health') {
    const response = setRequestIdHeader(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
    applySecurityHeaders(response, nonce);
    telemetry.durationMs = Date.now() - startTime;
    logTelemetry(telemetry);
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
    telemetry.durationMs = Date.now() - startTime;
    logTelemetry(telemetry);
    return response;
  }

  // 4. Identification (IP-based for anonymous requests)
  const ip = getSafeClientIp(request);
  const identifier = `api-ratelimit:${ip}`;

  telemetry.rateLimitApplied = true;

  const { success, limit, remaining, reset } = rateLimit(
    identifier,
    appConfig.rateLimit.max,
    appConfig.rateLimit.window
  );

  telemetry.rateLimitExceeded = !success;

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

  telemetry.durationMs = Date.now() - startTime;
  logTelemetry(telemetry);

  return setRequestIdHeader(response, requestId);
}

export const config = {
  matcher: '/api/:path*',
};
