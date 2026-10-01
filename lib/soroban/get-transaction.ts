import serverConfig from '@/lib/server-config';

export interface SorobanTransactionStatus {
  status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'PENDING' | string;
  raw?: unknown;
}

export async function getTransaction(hash: string): Promise<SorobanTransactionStatus> {
  const rpcUrl = serverConfig.stellar.sorobanRpcUrl || 'https://soroban-testnet.stellar.org';
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get_transaction',
      method: 'getTransaction',
      params: [hash],
    }),
  });

  if (!response.ok) {
    throw { code: response.status, message: `RPC request failed with HTTP ${response.status}` };
  }

  const data = await response.json();

  if (data.error) {
    throw data.error;
  }

  const result = data.result;
  if (!result) {
    return { status: 'NOT_FOUND', raw: null };
  }

  const rawStatus = (result.status || '').toUpperCase();
  let status = 'NOT_FOUND';
  if (rawStatus === 'SUCCESS') status = 'SUCCESS';
  else if (rawStatus === 'FAILED') status = 'FAILED';
  else if (rawStatus === 'NOT_FOUND') status = 'NOT_FOUND';
  else if (rawStatus) status = rawStatus;

  return { status, raw: result };
}

export default getTransaction;
