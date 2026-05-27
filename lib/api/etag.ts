import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Generates a stable W3C-format ETag from any serialisable value.
 * Uses a SHA-256 digest truncated to 32 hex characters so the header stays short.
 */
export function generateETag(data: unknown): string {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 32);
  return `"${hash}"`;
}

/**
 * Returns true when the client's If-None-Match header matches the current ETag,
 * meaning the resource has not changed and a 304 can be returned.
 */
export function isNotModified(request: NextRequest, etag: string): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  if (!ifNoneMatch) return false;
  // The wildcard '*' means "match any" — also valid for conditional GETs.
  return ifNoneMatch === etag || ifNoneMatch === '*';
}

export type CacheVisibility = 'public' | 'private';

/**
 * Returns the standard caching response headers for a route.
 *
 * - `public`  — safe for shared/CDN caches (price feeds, market data).
 * - `private` — user-specific data (transactions, account); must NOT be cached
 *   by intermediaries. A maxAge of 0 forces revalidation on every request.
 */
export function cacheHeaders(
  etag: string,
  maxAgeSeconds: number,
  visibility: CacheVisibility = 'public',
): Record<string, string> {
  const cacheControl =
    visibility === 'private'
      ? `private, no-cache, must-revalidate`
      : `public, max-age=${maxAgeSeconds}, must-revalidate`;

  const vary =
    visibility === 'private'
      ? 'Accept-Encoding, Authorization'
      : 'Accept-Encoding';

  return {
    ETag: etag,
    'Cache-Control': cacheControl,
    Vary: vary,
  };
}

/**
 * Minimal 304 response — includes only ETag and Cache-Control as required by RFC 9110.
 */
export function notModifiedResponse(
  etag: string,
  visibility: CacheVisibility = 'public',
): ResponseInit {
  const cacheControl =
    visibility === 'private' ? 'private, no-cache, must-revalidate' : 'public, must-revalidate';
  return {
    status: 304,
    headers: { ETag: etag, 'Cache-Control': cacheControl },
  };
}
