import serverConfig from '@/lib/server-config';
import { httpPost } from '@/lib/http/client';
import { type AssetSymbol } from '@/types/enums';
import { generateMockPositions, type RawPosition } from './liquidation';

const POOL_ASSETS: AssetSymbol[] = ['XLM', 'USDC', 'BTC', 'ETH'];

interface SorobanRpcEnvelope {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function buildGetUserPositionsRequest(walletAddress: string): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: 'get_user_positions',
    method: 'simulateTransaction',
    params: [
      {
        transaction: '',
        operations: [
          {
            type: 'invoke_host_function',
            function: 'get_user_positions',
            contract_id: process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID || '',
            args: [{ type: 'address', value: walletAddress }],
            footprint: {
              read_only: ['get_user_positions'],
              read_write: [],
            },
          },
        ],
      },
    ],
  };
}

function parsePositionsResult(result: unknown): RawPosition[] | null {
  if (!result || typeof result !== 'object') return null;

  const resultObj = result as Record<string, unknown>;
  const retval = resultObj.retval ?? resultObj.result ?? resultObj;
  if (!retval || typeof retval !== 'object') return null;

  const entries = (retval as Record<string, unknown>).entries ??
    (retval as Record<string, unknown>).vec ??
    retval;

  if (!Array.isArray(entries)) return null;

  const positions: RawPosition[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;

    const asset = String(row.asset ?? row.borrow_asset ?? '');
    const collateralAsset = String(row.collateral_asset ?? row.collateralAsset ?? '');
    const borrowedAmount = Number(row.borrowed_amount ?? row.borrowedAmount ?? 0);
    const collateralAmount = Number(row.collateral_amount ?? row.collateralAmount ?? 0);

    if (
      POOL_ASSETS.includes(asset as AssetSymbol) &&
      POOL_ASSETS.includes(collateralAsset as AssetSymbol)
    ) {
      positions.push({
        asset: asset as AssetSymbol,
        collateralAsset: collateralAsset as AssetSymbol,
        borrowedAmount,
        collateralAmount,
      });
    }
  }

  return positions.length > 0 ? positions : null;
}

async function fetchPositionsFromChain(walletAddress: string): Promise<RawPosition[] | null> {
  const rpcUrl = serverConfig.stellar.sorobanRpcUrl;
  if (!rpcUrl) return null;

  const payload = buildGetUserPositionsRequest(walletAddress);
  try {
    const response = await httpPost<SorobanRpcEnvelope>(rpcUrl, payload, {
      timeoutMs: 8000,
    });

    if (response.error) return null;
    if (!response.result) return null;

    return parsePositionsResult(response.result);
  } catch {
    return null;
  }
}

export async function fetchUserPositions(walletAddress: string): Promise<RawPosition[]> {
  const onChain = await fetchPositionsFromChain(walletAddress);
  if (onChain && onChain.length > 0) {
    return onChain;
  }

  return generateMockPositions(walletAddress);
}
