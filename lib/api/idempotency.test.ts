import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';
import { withIdempotency } from './idempotency';

const makeRequest = (body: unknown, headers: Record<string, string> = {}) => {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
};

describe('withIdempotency', () => {
  beforeEach(() => {
    globalCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the original cached response for duplicate requests with the same key', async () => {
    const handler = vi.fn(async () => {
      return NextResponse.json({ ok: true, invocation: 1 }, { status: 201 });
    });

    const request = makeRequest({ amount: 100 }, { 'Idempotency-Key': 'txn-123' });
    const firstResponse = await withIdempotency(request, handler);
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(201);
    expect(firstBody).toEqual({ ok: true, invocation: 1 });
    expect(handler).toHaveBeenCalledTimes(1);

    const duplicateRequest = makeRequest({ amount: 100 }, { 'Idempotency-Key': 'txn-123' });
    const duplicateResponse = await withIdempotency(duplicateRequest, handler);
    const duplicateBody = await duplicateResponse.json();

    expect(duplicateResponse.status).toBe(201);
    expect(duplicateBody).toEqual(firstBody);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns a conflict when the same idempotency key is reused with a different payload', async () => {
    const handler = vi.fn(async () => {
      return NextResponse.json({ ok: true, invocation: 1 }, { status: 201 });
    });

    const firstRequest = makeRequest({ amount: 100 }, { 'Idempotency-Key': 'txn-999' });
    await withIdempotency(firstRequest, handler);

    const conflictingRequest = makeRequest({ amount: 200 }, { 'Idempotency-Key': 'txn-999' });
    const conflictResponse = await withIdempotency(conflictingRequest, handler);
    const conflictBody = await conflictResponse.json();

    expect(conflictResponse.status).toBe(409);
    expect(conflictBody.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(conflictBody.error.message).toContain('txn-999');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not cache requests without an idempotency key', async () => {
    const handler = vi.fn(async () => {
      return NextResponse.json({ ok: true }, { status: 200 });
    });

    const firstRequest = makeRequest({ amount: 100 });
    await withIdempotency(firstRequest, handler);

    const secondRequest = makeRequest({ amount: 100 });
    await withIdempotency(secondRequest, handler);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(globalCache.size()).toBe(0);
  });
});
