import { NextResponse } from 'next/server';
import { metricsRegistry } from '@/lib/metrics/registry';

export const runtime = 'nodejs';

export async function GET() {
  const metrics = await metricsRegistry.metrics();
  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-Type': metricsRegistry.contentType || 'text/plain; version=0.0.4; charset=utf-8',
    },
  });
}
