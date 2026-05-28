import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedIdempotencyResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
  setCookie: string[];
  payloadHash: string;
}

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildCacheKey(key: string): string {
  return `idempotency:${hashValue(key.trim())}`;
}

function cloneBodyAndHeaders(response: Response): Promise<CachedIdempotencyResponse> {
  const clone = response.clone();

  return clone.text().then((body) => {
    const headers: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') return;
      headers[key] = value;
    });

    const setCookie = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];

    return {
      status: response.status,
      body,
      headers,
      setCookie,
      payloadHash: '',
    };
  });
}

function replayCachedResponse(record: CachedIdempotencyResponse): NextResponse {
  const headers = new Headers();

  Object.entries(record.headers).forEach(([key, value]) => {
    headers.set(key, value);
  });

  record.setCookie.forEach((cookie) => {
    headers.append('Set-Cookie', cookie);
  });

  return new NextResponse(record.body, {
    status: record.status,
    headers,
  });
}

export async function withIdempotency(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<Response>
): Promise<Response> {
  const rawKey = request.headers.get(IDEMPOTENCY_HEADER);

  if (!rawKey?.trim()) {
    return handler(request);
  }

  const key = rawKey.trim();
  const payload = await request.clone().text();
  const payloadHash = hashValue(payload);
  const cacheKey = buildCacheKey(key);

  const cachedRecord = globalCache.getEntry<CachedIdempotencyResponse>(cacheKey);

  if (cachedRecord) {
    if (cachedRecord.value.payloadHash !== payloadHash) {
      return NextResponse.json(
        {
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: `Idempotency key "${key}" was already used with a different payload.`,
          },
        },
        { status: 409 }
      );
    }

    return replayCachedResponse(cachedRecord.value);
  }

  const response = await handler(request);
  const record = await cloneBodyAndHeaders(response);
  record.payloadHash = payloadHash;

  globalCache.set(cacheKey, record, {
    ttl: IDEMPOTENCY_TTL_MS,
    swr: 0,
  });

  return response;
}
