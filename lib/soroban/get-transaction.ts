import 'server-only';

export interface GetTransactionResult {
  status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'PENDING';
  raw?: unknown;
}

/**
 * Query the Soroban RPC for the status of a submitted transaction by hash.
 */
export default async function getTransaction(hash: string): Promise<GetTransactionResult> {
  const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: { hash },
  });

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Soroban RPC request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(json.error.message ?? 'Soroban RPC error');
  }

  const result = json.result as { status?: string; [key: string]: unknown } | undefined;
  const status = result?.status?.toUpperCase();

  if (status === 'SUCCESS') return { status: 'SUCCESS', raw: result };
  if (status === 'FAILED') return { status: 'FAILED', raw: result };
  if (status === 'NOT_FOUND') return { status: 'NOT_FOUND', raw: result };

  return { status: 'PENDING', raw: result };
}
