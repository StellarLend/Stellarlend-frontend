import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';
import { httpPost } from '@/lib/http/client';
import {
  buildSorobanRpcError,
  buildSorobanTransactionRpcRequest,
  extractUnsignedXdr,
  isTxBuildRequest,
  TxBuildRequest,
} from '@/lib/soroban/tx';

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
        message: 'Failed to build Soroban transaction with upstream RPC.',
      },
    },
    { status: 502 },
  );

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidBody();
  }

  if (!isTxBuildRequest(body)) {
    return invalidBody();
  }

  if (!config.stellar.sorobanContractId) {
    return NextResponse.json(
      {
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Soroban contract ID is not configured on the server.',
        },
      },
      { status: 500 },
    );
  }

  const payload = buildSorobanTransactionRpcRequest(
    body as TxBuildRequest,
    config.stellar.sorobanContractId,
    config.stellar.network,
  );

  try {
    const rpcResponse = await httpPost<unknown>(config.stellar.sorobanRpcUrl, payload, {
      timeoutMs: 10000,
    });

    if (typeof rpcResponse === 'object' && rpcResponse && 'error' in rpcResponse) {
      return NextResponse.json(
        { error: buildSorobanRpcError((rpcResponse as any).error) },
        { status: 502 },
      );
    }

    const unsignedXdr = extractUnsignedXdr((rpcResponse as any).result ?? rpcResponse);
    if (!unsignedXdr) {
      return rpcFailure();
    }

    return NextResponse.json({ unsignedXdr }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: buildSorobanRpcError(error) },
      { status: 502 },
    );
  }
}
