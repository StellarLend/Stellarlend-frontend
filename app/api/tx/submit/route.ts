import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';
import { httpPost } from '@/lib/http/client';
import { metrics } from '@/lib/metrics/registry';
import {
  buildSorobanRpcError,
  buildSorobanSubmitRpcRequest,
  extractSubmitResult,
  isTxSubmitRequest,
} from '@/lib/soroban/tx';
import { withCsrfProtection } from '@/lib/api/handler';
import { getSession } from '@/lib/auth';
import { accountBucketRateLimit } from '@/lib/rate-limit/account-bucket';

export const runtime = 'nodejs';

const invalidBody = () =>
  NextResponse.json(
    { error: { code: 'INVALID_INPUT', message: 'Invalid request body.' } },
    { status: 400 },
  );

const rpcFailure = () =>
  NextResponse.json(
    {
      error: {
        code: 'RPC_ERROR',
        message: 'Failed to submit signed Soroban transaction to the network.',
      },
    },
    { status: 502 },
  );

const postHandler = async (request: NextRequest) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidBody();
  }

  if (!isTxSubmitRequest(body)) {
    return invalidBody();
  }

  const session = await getSession();
  const walletAddress = session?.user?.walletAddress;

  if (walletAddress) {
    const accountLimit = accountBucketRateLimit(walletAddress, config.rateLimit.account);
    if (!accountLimit.success) {
      const response = NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Account rate limit exceeded. Please try again later.',
            limit: accountLimit.limit,
            remaining: accountLimit.remaining,
            reset: accountLimit.reset,
            retryAfter: accountLimit.retryAfter,
          },
        },
        { status: 429 },
      );

      response.headers.set('X-RateLimit-Limit', accountLimit.limit.toString());
      response.headers.set('X-RateLimit-Remaining', accountLimit.remaining.toString());
      response.headers.set('X-RateLimit-Reset', accountLimit.reset.toString());
      response.headers.set('Retry-After', accountLimit.retryAfter.toString());
      return response;
    }
  }

  const payload = buildSorobanSubmitRpcRequest(body.signedEnvelopeXdr);

  try {
    const start = Date.now();
    const rpcResponse = await httpPost<unknown>(config.stellar.sorobanRpcUrl, payload, {
      timeoutMs: 10000,
    });
    const dur = (Date.now() - start) / 1000;
    try {
      metrics.sorobanSubmissions.inc({ result: 'success' });
      metrics.sorobanSubmitDuration.observe(dur, { result: 'success' });
    } catch (e) {}

    if (typeof rpcResponse === 'object' && rpcResponse && 'error' in rpcResponse) {
      return NextResponse.json(
        { error: buildSorobanRpcError((rpcResponse as any).error) },
        { status: 502 },
      );
    }

    const submission = extractSubmitResult((rpcResponse as any).result ?? rpcResponse);
    if (!submission || !submission.hash) {
      return rpcFailure();
    }

    return NextResponse.json(
      { status: 'submitted', hash: submission.hash },
      { status: 200 },
    );
  } catch (error) {
    try {
      metrics.sorobanSubmissions.inc({ result: 'failure' });
      metrics.sorobanSubmitDuration.observe(0, { result: 'failure' });
    } catch (e) {}

    return NextResponse.json(
      { error: buildSorobanRpcError(error) },
      { status: 502 },
    );
  }
};

export const POST = withCsrfProtection(postHandler);
