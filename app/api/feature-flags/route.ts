// app/api/feature-flags/route.ts
import { NextResponse } from 'next/server';
import { evaluateAllFlags } from '@/lib/flags/evaluator';

// Simple in‑memory cache to avoid re‑evaluating on every request within a short TTL.
const cache = new Map<string, { flags: Record<string, boolean>; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id') ?? 'anonymous';
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.flags);
  }
  const flags = evaluateAllFlags(userId);
  cache.set(userId, { flags, ts: now });
  return NextResponse.json(flags);
}
