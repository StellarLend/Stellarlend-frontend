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

export function withCsrfProtection<T extends (...args: any[]) => Promise<NextResponse> | NextResponse>(handler: T) {
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

export function withRequestLogging<T extends (...args: any[]) => Promise<NextResponse> | NextResponse>(route: string, handler: T) {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const request = args[0] as NextRequest | undefined;
    const method = request?.method ?? 'UNKNOWN';
    const startedAt = Date.now();
    const requestId = request?.headers ? getOrCreateRequestId(request.headers).requestId : 'internal-' + startedAt;

    return runWithRequestContext({ requestId }, async () => {
      const chaosResponse = await chaosInject(request as NextRequest);
      if (chaosResponse) {
        chaosResponse.headers.set(REQUEST_ID_HEADER, requestId);
        return chaosResponse as ReturnType<T>;
      }

      let requestContext: any = null;
      try {
        requestContext = {
          method,
          route,
          query: request?.nextUrl?.searchParams.toString() ?? '',
          requestId,
          headers: {
            authorization: request?.headers?.get('authorization') ?? undefined,
            'x-forwarded-for': request?.headers?.get('x-forwarded-for') ?? undefined,
            [REQUEST_ID_HEADER]: requestId,
          },
        };

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

        if (response instanceof NextResponse) {
          response.headers.set(REQUEST_ID_HEADER, requestId);
        }
        return response;
      } catch (error) {
        if (error instanceof Response) {
          error.headers.set(REQUEST_ID_HEADER, requestId);
          return error as ReturnType<T>;
        }
        const durationMs = Date.now() - startedAt;

        try {
          metrics.httpRequests.inc({ method, route, status: '500' });
          metrics.httpRequestDuration.observe(durationMs / 1000, { method, route, status: '500' });
          metrics.httpErrors.inc({ route, error: (error as Error)?.name ?? 'Error' });
        } catch (e) {
          // swallow metrics errors
        }

        try {
          captureServerError(error, {
            route,
            method,
            requestId,
            query: request?.nextUrl?.searchParams.toString() ?? '',
            headers: {
              authorization: request?.headers?.get('authorization') ?? undefined,
              'x-forwarded-for': request?.headers?.get('x-forwarded-for') ?? undefined,
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

        const errorResponse = NextResponse.json(
          { error: 'Internal server error' },
          { status: 500, headers: { [REQUEST_ID_HEADER]: requestId } },
        );
        return errorResponse as ReturnType<T>;
      }
    }) as Promise<ReturnType<T>>;
  };
}
