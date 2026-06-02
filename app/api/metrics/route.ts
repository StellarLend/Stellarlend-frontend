import { NextResponse } from 'next/server';
import serverConfig from '@/lib/server-config';
import { metrics } from '@/lib/metrics/registry';

export const runtime = 'nodejs';

/**
 * GET /api/metrics
 * Prometheus exposition endpoint. Protected via bearer token configured
 * in lib/server-config.ts (server.token). Exempt this path from rate
 * limiting in the rate limiter configuration to allow scrapers.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : '';

  if (!token || token !== serverConfig.server.token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = metrics.collect();
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4',
      'Cache-Control': 'no-cache',
    },
  });
}
