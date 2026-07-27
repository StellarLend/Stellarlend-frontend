import config from '@/lib/config';
import { httpPost } from '@/lib/http/client';

export interface GetTransactionResult {
  status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | string;
  raw?: unknown;
}

export async function getTransaction(hash: string): Promise<GetTransactionResult> {
  const rpcUrl = config.stellar.sorobanRpcUrl || 'https://soroban-testnet.stellar.org';
  const requestBody = {
    jsonrpc: '2.0',
    id: 'get_transaction',
    method: 'getTransaction',
    params: [hash],
  };

  const response = await httpPost<Record<string, unknown>>(rpcUrl, requestBody);

  if (response && typeof response === 'object' && 'error' in response && response.error) {
    throw response.error;
  }

  const result = response?.result as Record<string, unknown> | null | undefined;
  if (!result) {
    return { status: 'NOT_FOUND', raw: null };
  }

  const rawStatus = typeof result.status === 'string' ? result.status.toUpperCase() : 'UNKNOWN';

  return {
    status: rawStatus,
    raw: result,
  };
}

export default getTransaction;
