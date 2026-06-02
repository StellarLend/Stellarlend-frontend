import { Readable } from 'node:stream';
import { constants as zlibConstants, createBrotliCompress, createGzip } from 'node:zlib';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics/registry';
import { chaosInject } from '@/lib/chaos/inject';
import { verifyCsrfToken } from '@/lib/security/csrf';

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

function appendVary(headers: Headers, value: string) {
  const existing = headers.get('Vary');
  if (!existing) {
    headers.set('Vary', value);
    return;
  }

  const values = existing.split(',').map((entry) => entry.trim().toLowerCase());
  if (!values.includes(value.toLowerCase())) {
    headers.set('Vary', `${existing}, ${value}`);
  }
}

function acceptsCompressionOptOut(request: NextRequest | undefined) {
  return request?.headers.get(RESPONSE_COMPRESSION_OPT_OUT_HEADER)?.toLowerCase() === 'off';
}

function parseAcceptEncoding(header: string | null): CompressionEncoding | null {
  if (!header) return null;

  const qByCoding = new Map<string, number>();
  for (const entry of header.split(',')) {
    const [rawCoding, ...params] = entry.trim().split(';');
    const coding = rawCoding.trim().toLowerCase();
    const qParam = params.find((param) => param.trim().toLowerCase().startsWith('q='));
    const q = qParam ? Number(qParam.split('=')[1]) : 1;
    qByCoding.set(coding, Number.isFinite(q) ? q : 0);
  }

  const brQ = qByCoding.get('br') ?? qByCoding.get('*') ?? 0;
  const gzipQ = qByCoding.get('gzip') ?? qByCoding.get('*') ?? 0;
  if (brQ <= 0 && gzipQ <= 0) return null;

  return brQ >= gzipQ ? 'br' : 'gzip';
}

function isCompressibleContentType(contentType: string | null) {
  if (!contentType) return true;

  const normalized = contentType.toLowerCase();
  if (
    normalized.includes('text/event-stream') ||
    normalized.includes('text/csv') ||
    normalized.includes('application/zip') ||
    normalized.includes('application/gzip') ||
    normalized.includes('application/x-gzip') ||
    normalized.startsWith('image/') ||
    normalized.startsWith('audio/') ||
    normalized.startsWith('video/')
  ) {
    return false;
  }

  return (
    normalized.startsWith('text/') ||
    normalized.includes('json') ||
    normalized.includes('xml') ||
    normalized.includes('javascript') ||
    normalized.includes('wasm')
  );
}

function createCompressedStream(body: ReadableStream<Uint8Array>, encoding: CompressionEncoding) {
  const compressor =
    encoding === 'br'
      ? createBrotliCompress({
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
          },
        })
      : createGzip({ level: zlibConstants.Z_BEST_SPEED });

  return Readable.toWeb(Readable.fromWeb(body).pipe(compressor)) as ReadableStream<Uint8Array>;
}

function responseHasBody(response: Response, method: string | undefined) {
  return method !== 'HEAD' && response.body !== null && response.status !== 204 && response.status !== 304;
}

function buildCompressedResponse(response: Response, encoding: CompressionEncoding, body: ReadableStream<Uint8Array>) {
  const headers = new Headers(response.headers);
  headers.set('Content-Encoding', encoding);
  appendVary(headers, 'Accept-Encoding');
  headers.delete('Content-Length');
  headers.delete('Content-MD5');

  return new NextResponse(createCompressedStream(body, encoding), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function applyResponseCompression(
  request: NextRequest | undefined,
  response: NextResponse,
  minBytes = RESPONSE_COMPRESSION_MIN_BYTES
): Promise<NextResponse> {
  if (!request || acceptsCompressionOptOut(request)) return response;

  const headers = new Headers(response.headers);
  if (!responseHasBody(response, request.method) || headers.has('Content-Encoding')) return response;

  const encoding = parseAcceptEncoding(request.headers.get('Accept-Encoding'));
  if (!encoding) return response;

  if (!isCompressibleContentType(headers.get('Content-Type'))) return response;

  appendVary(headers, 'Accept-Encoding');

  const contentLength = headers.get('Content-Length');
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength < minBytes) {
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    if (response.body) {
      return buildCompressedResponse(
        new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        }),
        encoding,
        response.body
      );
    }
  }

  const cloned = response.clone();
  const body = new Uint8Array(await cloned.arrayBuffer());
  if (body.byteLength < minBytes) {
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return buildCompressedResponse(
    new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
    encoding,
    new Response(body).body as ReadableStream<Uint8Array>
  );
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

      return (await applyResponseCompression(request, response)) as ReturnType<T>;
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      try {
        metrics.httpRequests.inc({ method, route, status: '500' });
        metrics.httpRequestDuration.observe(durationMs / 1000, { method, route, status: '500' });
        metrics.httpErrors.inc({ route, error: (error as Error)?.name ?? 'Error' });
      } catch (e) {
        // swallow metrics errors
      }

      await captureRequestError(error, {
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
