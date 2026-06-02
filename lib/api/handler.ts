import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics/registry';
import { chaosInject } from '@/lib/chaos/inject';
import { verifyCsrfToken } from '@/lib/security/csrf';

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return String(error);
}

export function withCsrfProtection<T extends (...args: unknown[]) => Promise<NextResponse> | NextResponse>(handler: T) {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const request = args[0] as NextRequest | undefined;
    if (request) {
      const method = request.method;
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        if (!verifyCsrfToken(request)) {
          return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }) as ReturnType<T>;
        }
      }
    }
    return handler(...args);
  };
}

export function withRequestLogging<T extends (...args: unknown[]) => Promise<NextResponse> | NextResponse>(route: string, handler: T) {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const startedAt = Date.now();
    const request = args[0] as NextRequest | undefined;
    const method = request?.method ?? 'UNKNOWN';
    const sessionId = request?.cookies.get('session')?.value;

    const requestContext = {
      method,
      route,
      query: request?.nextUrl?.searchParams.toString() ?? '',
      headers: {
        authorization: request?.headers.get('authorization'),
        'x-forwarded-for': request?.headers.get('x-forwarded-for'),
      },
    };

    const chaosResponse = await chaosInject(request as NextRequest);
    if (chaosResponse) {
      return chaosResponse;
    }

    try {
      const response = await handler(...args);
      const durationMs = Date.now() - startedAt;
      const status = typeof (response as any)?.status === 'number' ? (response as any).status : 0;

      try {
        metrics.httpRequests.inc({ method, route, status: String(status) });
        metrics.httpRequestDuration.observe(durationMs / 1000, { method, route, status: String(status) });
      } catch (e) {
        // swallow metrics errors
      }

      logger.info('request completed', route, {
        status,
        durationMs,
        request: requestContext,
      });

      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      try {
        metrics.httpRequests.inc({ method, route, status: '500' });
        metrics.httpRequestDuration.observe(durationMs / 1000, { method, route, status: '500' });
        metrics.httpErrors.inc({ route, error: (error as Error)?.name ?? 'Error' });
      } catch (e) {
        // swallow metrics errors
      }

      captureServerError(error, {
        route,
        method,
        sessionId,
      });

      logger.error('request failed', route, {
        durationMs,
        error: serializeError(error),
        request: requestContext,
      });

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) as ReturnType<T>;
    }
  };
}