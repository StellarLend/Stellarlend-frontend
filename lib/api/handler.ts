import { NextResponse } from 'next/server';
import { UpstreamHttpError, TimeoutError } from '@/lib/http';
import { ValidationError, AuthError, UpstreamError } from './errors';

// ─── Envelope types ───────────────────────────────────────────────────────────

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function errorResponse(status: number, code: string, message: string): NextResponse<ErrorEnvelope> {
  return NextResponse.json<ErrorEnvelope>(
    { success: false, error: { code, message } },
    { status },
  );
}

// ─── withHandler ─────────────────────────────────────────────────────────────

/**
 * Wraps an API route handler in a consistent JSON error envelope.
 *
 * On success  → `{ success: true, data: T }` with HTTP 200.
 * On failure  → `{ success: false, error: { code, message } }` with the
 *               appropriate HTTP status code.
 *
 * Stack traces and raw error messages are suppressed in production for
 * unknown errors to prevent information leakage.
 */
export async function withHandler<T>(
  fn: () => Promise<T>,
): Promise<NextResponse<SuccessEnvelope<T> | ErrorEnvelope>> {
  try {
    const result = await fn();
    return NextResponse.json<SuccessEnvelope<T>>(
      { success: true, data: result },
      { status: 200 },
    );
  } catch (err) {
    // ── Known domain errors ────────────────────────────────────────────────
    if (err instanceof ValidationError) {
      return errorResponse(400, 'VALIDATION_ERROR', err.message);
    }

    if (err instanceof AuthError) {
      return errorResponse(401, 'AUTH_ERROR', err.message);
    }

    if (err instanceof UpstreamError) {
      return errorResponse(502, 'UPSTREAM_ERROR', err.message);
    }

    // ── lib/http transport errors → upstream ──────────────────────────────
    if (err instanceof UpstreamHttpError || err instanceof TimeoutError) {
      return errorResponse(502, 'UPSTREAM_ERROR', (err as Error).message);
    }

    // ── Unexpected errors ─────────────────────────────────────────────────
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction
      ? 'An unexpected error occurred'
      : (err instanceof Error ? err.message : String(err));

    return errorResponse(500, 'INTERNAL_ERROR', message);
  }
}
