import { Readable } from 'node:stream';
import { constants as zlibConstants, createBrotliCompress, createGzip } from 'node:zlib';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics/registry';
import { chaosInject } from '@/lib/chaos/inject';
import { verifyCsrfToken } from '@/lib/security/csrf';
import { captureServerError } from '@/lib/telemetry/sentry';
import { getOrCreateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id';
import { runWithRequestContext } from '@/lib/request-context';

export const RESPONSE_COMPRESSION_MIN_BYTES = 1024;
export const RESPONSE_COMPRESSION_OPT_OUT_HEADER = 'X-Stellarlend-Compression';

type CompressionEncoding = 'br' | 'gzip';

async function captureRequestError(
  error: unknown,
  context: {
    route?: string;
    method?: string;
    sessionId?: string;
  }
) {
  try {
    const { captureServerError } = await import('@/lib/telemetry/sentry');
    captureServerError(error, context);
  } catch {
    // Sentry must never prevent returning the API error response.
  }
}

export type ApiHandler = (
  request: NextRequest,
  ...args: unknown[]
) => Promise<NextResponse> | NextResponse;

export type RequestLogContext = {
  method: string;
  route: string;
  query: string;
  requestId: string;
  headers: {
    authorization: string | undefined;
    'x-forwarded-for': string | undefined;
    [REQUEST_ID_HEADER]: string;
  };
};

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

export function withCsrfProtection<T extends ApiHandler>(handler: T): T {
  return (async (...args: Parameters<T>): Promise<NextResponse> => {
    const request = args[0];
    if (request instanceof NextRequest) {
      const method = request.method;
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        if (!verifyCsrfToken(request)) {
          return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
        }
      }
    }
    return handler(...args);
  }) as T;
}

export function withRequestLogging<T extends ApiHandler>(route: string, handler: T): T {
  return (async (...args: Parameters<T>): Promise<NextResponse> => {
    const request = args[0];
    const method = request instanceof NextRequest ? request.method : 'UNKNOWN';
    const startedAt = Date.now();
    const requestId =
      request instanceof NextRequest && request.headers
        ? getOrCreateRequestId(request.headers).requestId
        : 'internal-' + startedAt;

    return runWithRequestContext({ requestId }, async () => {
      const chaosResponse = request instanceof NextRequest ? await chaosInject(request) : null;
      if (chaosResponse) {
        chaosResponse.headers.set(REQUEST_ID_HEADER, requestId);
        return chaosResponse;
      }

      let requestContext: RequestLogContext | null = null;
      try {
        requestContext = {
          method,
          route,
          query: request instanceof NextRequest ? request.nextUrl.searchParams.toString() : '',
          requestId,
          headers: {
            authorization: request instanceof NextRequest ? request.headers.get('authorization') ?? undefined : undefined,
            'x-forwarded-for': request instanceof NextRequest ? request.headers.get('x-forwarded-for') ?? undefined : undefined,
            [REQUEST_ID_HEADER]: requestId,
          },
        };

        const response = await handler(...args);
        const durationMs = Date.now() - startedAt;
        const status = response instanceof NextResponse && typeof response.status === 'number' ? response.status : 0;

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

        if (response instanceof NextResponse) {
          response.headers.set(REQUEST_ID_HEADER, requestId);
        }
        return response;
      } catch (error) {
        if (error instanceof Response) {
          error.headers.set(REQUEST_ID_HEADER, requestId);
          return error;
        }
        const durationMs = Date.now() - startedAt;

        try {
          metrics.httpRequests.inc({ method, route, status: '500' });
          metrics.httpRequestDuration.observe(durationMs / 1000, { method, route, status: '500' });
          metrics.httpErrors.inc({ route, error: (error instanceof Error ? error : new Error(String(error))).name });
        } catch {
          // swallow metrics errors
        }

        try {
          captureServerError(error, {
            route,
            method,
            query: request instanceof NextRequest ? request.nextUrl.searchParams.toString() : '',
            headers: {
              authorization: request instanceof NextRequest ? request.headers.get('authorization') ?? undefined : undefined,
              'x-forwarded-for': request instanceof NextRequest ? request.headers.get('x-forwarded-for') ?? undefined : undefined,
              [REQUEST_ID_HEADER]: requestId,
            },
          });
        } catch {
          // swallow Sentry errors
        }

        logger.error('request failed', route, {
          durationMs,
          error: serializeError(error),
          request: requestContext,
        });

        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500, headers: { [REQUEST_ID_HEADER]: requestId } },
        );
      }
    });
  }) as T;
}
