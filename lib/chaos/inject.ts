import { NextRequest, NextResponse } from 'next/server';
import serverConfig from '@/lib/server-config';
import { logger } from '@/lib/logger';

/**
 * Chaos injection middleware.
 * Reads `x-chaos-inject` header (JSON) and optionally injects latency,
 * a 5xx error, or a 429 rate‑limit response. Disabled in production.
 * Returns a NextResponse if a response should be short‑circuited,
 * otherwise null so the normal handler can continue.
 */
export async function chaosInject(request: NextRequest): Promise<NextResponse | null> {
  // Respect the global enable flag and never run in production builds.
  const enable = process.env.ENABLE_CHAOS_INJECTION === 'true' && process.env.NODE_ENV !== 'production';
  if (!enable) {
    return null;
  }

  const header = request.headers.get('x-chaos-inject');
  if (!header) {
    return null;
  }

  let config: { latency?: number; status?: number; rateLimit?: number } = {};
  try {
    config = JSON.parse(header);
  } catch (e) {
    logger.warn('Invalid x-chaos-inject header JSON', { error: e });
    return null;
  }

  const route = request.nextUrl.pathname;

  // Latency injection (milliseconds)
  if (config.latency && config.latency > 0) {
    logger.info('Injecting latency', { route, latency: config.latency });
    await new Promise((resolve) => setTimeout(resolve, config.latency));
  }

  // Rate‑limit injection – respond with 429
  if (config.rateLimit && config.rateLimit > 0) {
    logger.info('Injecting rate‑limit', { route, rateLimit: config.rateLimit });
    // In a real implementation a token‑bucket would be used; here we short‑circuit.
    return NextResponse.json({ error: 'Rate limit injected by chaos middleware' }, { status: 429 });
  }

  // 5xx error injection
  if (config.status && config.status >= 500 && config.status < 600) {
    logger.info('Injecting error status', { route, status: config.status });
    return NextResponse.json({ error: `Injected ${config.status} error by chaos middleware` }, { status: config.status });
  }

  // If we reach here, only latency (or none) was applied.
  logger.info('Chaos injection completed', { route });
  return null;
}
