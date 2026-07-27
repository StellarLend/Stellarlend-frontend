import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import appConfig from '@/lib/config';
import { getOrCreateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';

function generateNonce(): string {
  const array = new Uint8Array(16);
  (globalThis.crypto || crypto).getRandomValues(array);
  return btoa(String.fromCharCode(...array));
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Path Filter: Only apply to API routes
  if (!pathname.startsWith('/api')) {
    // For non‑API routes, still set CSP header with nonce for inline scripts
    const nonce = generateNonce();
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}';`);
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('x-csp-nonce', nonce);
    return response;
  }

  const { requestId, requestHeaders, nonce } = getRequestIdHeaders(request);

  // 2. Exemption: Health checks should never be rate limited
  if (pathname === '/api/health') {
    const response = setRequestIdHeader(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
    response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}';`);
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  }

  // 3. Exemption: Authenticated internal calls
  const sessionCookieName = appConfig.rateLimit ? (process.env.NEXT_PUBLIC_SESSION_COOKIE || 'session') : 'session';
  const isAuth = request.cookies.has(sessionCookieName);

  if (isAuth) {
    const response = setRequestIdHeader(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
    response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}';`);
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  }

  // 4. Identification (IP-based for anonymous requests)
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const identifier = `api-ratelimit:${ip}`;

  const { success, limit, remaining, reset } = rateLimit(
    identifier,
    appConfig.rateLimit.max,
    appConfig.rateLimit.window
  );

  // 5. Prepare Response
  let response: NextResponse;

  if (success) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    response = new NextResponse(
      JSON.stringify({ 
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.' 
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Set CSP header on every response
  response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}';`);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 6. Standard Rate Limit Headers
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.floor(reset / 1000).toString());

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    response.headers.set('Retry-After', Math.max(0, retryAfter).toString());
  }

  return setRequestIdHeader(response, requestId);
}

export const config = {
  matcher: '/api/:path*',
};
