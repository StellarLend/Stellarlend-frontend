import { NextRequest, NextResponse } from 'next/server';
import getTransaction from '@/lib/soroban/get-transaction';
import { SimpleCache, DEFAULT_TTL_MS } from '@/lib/cache';
import { buildSorobanRpcError } from '@/lib/soroban/tx';

export const runtime = 'nodejs';

const cache = new SimpleCache<{ status: string; raw?: unknown }>();

function badRequest() {
  return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Invalid transaction hash.' } }, { status: 400 });
}

export async function GET(_req: NextRequest, { params }: { params: { hash?: string } }) {
  const hash = params?.hash ?? '';

  // Reject non-hex inputs
  if (!hash || !/^[0-9a-fA-F]+$/.test(hash)) return badRequest();

  try {
    const cached = cache.get(hash);
    if (cached) {
      return NextResponse.json({ status: cached.status, cached: true, raw: cached.raw ?? null }, { status: 200 });
    }

    const result = await getTransaction(hash);

    if (result.status === 'SUCCESS' || result.status === 'FAILED') {
      cache.set(hash, { status: result.status, raw: result.raw }, DEFAULT_TTL_MS);
    }

    return NextResponse.json({ status: result.status, cached: false, raw: result.raw ?? null }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: buildSorobanRpcError(err) }, { status: 502 });
  }
}

export default GET;
