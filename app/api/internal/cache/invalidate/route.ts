import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import serverConfig from '@/lib/server-config';
import { globalCache } from '@/lib/cache';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

function errorResponse(status: number) {
  return NextResponse.json({ error: 'Unauthorized' }, { status });
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

function safeTokenEquals(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

async function authorize(request: NextRequest): Promise<boolean> {
  if (request.method !== 'POST') return false;

  const origin = request.headers.get('Origin');
  if (origin) {
    const allowedOrigins = serverConfig.server.cacheInvalidateAllowedOrigins;
    if (
      allowedOrigins.length === 0 ||
      !allowedOrigins.includes(normalizeOrigin(origin))
    ) {
      return false;
    }
  }

  const auth = request.headers.get('Authorization') || '';
  if (!auth) return false;

  // Accept Bearer <token>
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return safeTokenEquals(parts[1], serverConfig.server.token);
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const ok = await authorize(request);
    if (!ok) {
      return errorResponse(401);
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.namespaces)) {
      return NextResponse.json({ error: 'Invalid request body. Expected { namespaces: string[] }' }, { status: 400 });
    }

    const namespaces = body.namespaces.filter((n: unknown) => typeof n === 'string') as string[];

    const deletedCount = globalCache.invalidateNamespaces(namespaces);

    // Emit a simple metric and audit log entry
    console.log(`metric:cache_invalidate count=${deletedCount} namespaces=${namespaces.join(',')}`);

    logger.info('Cache invalidation requested', '/api/internal/cache/invalidate', { namespaces, deletedCount });

    return NextResponse.json({ deletedCount }, { status: 200 });
  } catch (err) {
    console.error('Cache invalidate route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
