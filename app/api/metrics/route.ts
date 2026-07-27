import { NextResponse } from 'next/server';
import serverConfig from '@/lib/server-config';
import { metrics } from '@/lib/metrics/registry';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : '';

  if (!token || token !== serverConfig.server.token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body = metrics.collect();

  if (!body.includes('\nscheduler_is_leader ')) {
    body += '\nscheduler_is_leader 0\n';
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4',
      'Cache-Control': 'no-cache',
    },
  });
}