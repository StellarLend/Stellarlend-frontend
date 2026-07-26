import type { LendingData } from '@/lib/lending/types';

export type SorobanRpcError = {
  code: number | string;
  message: string;
  data?: unknown;
};

export type SorobanRpcBuildResult = {
  transaction?: string;
  transaction_xdr?: string;
  [key: string]: unknown;
};

export type SorobanRpcSubmitResult = {
  hash?: string;
  status?: string;
  [key: string]: unknown;
};

export interface TxBuildRequest {
  type: 'lend' | 'borrow';
  sourceAccount: string;
  data: LendingData;
  /**
   * Optional per-transaction fee override expressed in stellar stroops.
   * When omitted, the server-side default (`SOROBAN_TRANSACTION_FEE` env var,
   * or `DEFAULT_SOROBAN_TRANSACTION_FEE`) is used.
   */
  fee?: number;
}

export interface TxSubmitRequest {
  signedEnvelopeXdr: string;
}

/**
 * Default per-transaction fee in stellar stroops. Mirrors the legacy hardcoded
 * value so that existing callers continue to behave the same way; operators can
 * override the value server-side via the `SOROBAN_TRANSACTION_FEE` env var, or
 * on a per-request basis by passing a `fee` override on `TxBuildRequest`.
 */
export const DEFAULT_SOROBAN_TRANSACTION_FEE = 100;

export interface BuildSorobanTransactionOptions {
  /**
   * Optional override for the transaction fee, expressed in stroops. Must be
   * a non-negative finite number; otherwise `buildSorobanTransactionRpcRequest`
   * throws an `Error`.
   */
  fee?: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isValidStellarPublicKey = (value: unknown): value is string =>
  typeof value === 'string' && /^[G][A-Z2-7]{55}$/.test(value);

const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Coerces an arbitrary value into the `string | number` contract of
 * `SorobanRpcError.code`. JSON deserializers normally surface scalar codes, but
 * upstream RPC errors occasionally include objects, arrays or `bigint`s; those
 * values previously leaked through the `string | number` type contract. We
 * fall back to `'UNKNOWN_ERROR'` to keep the response shape predictable.
 */
function coerceErrorCode(value: unknown): string | number {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return value.toString();
  return 'UNKNOWN_ERROR';
}

function resolveTransactionFee(options: BuildSorobanTransactionOptions | undefined): number {
  const candidate = options?.fee ?? DEFAULT_SOROBAN_TRANSACTION_FEE;
  if (!isFiniteNonNegativeNumber(candidate)) {
    throw new Error(
      `Invalid Soroban transaction fee: expected a non-negative finite number, received ${String(candidate)}.`,
    );
  }
  return candidate;
}

export function isTxBuildRequest(value: unknown): value is TxBuildRequest {
  if (!isObject(value)) return false;
  if (value.type !== 'lend' && value.type !== 'borrow') return false;
  if (!isValidStellarPublicKey(value.sourceAccount)) return false;
  if (!isObject(value.data)) return false;

  const data = value.data as Record<string, unknown>;
  if (!isNonEmptyString(data.asset)) return false;
  if (typeof data.amount !== 'number') return false;
  if (typeof data.interestRate !== 'number') return false;
  if (data.duration != null && typeof data.duration !== 'number') return false;
  if (data.collateral != null && !isNonEmptyString(data.collateral)) return false;
  if (data.collateralAmount != null && typeof data.collateralAmount !== 'number') return false;
  if (value.fee !== undefined && !isFiniteNonNegativeNumber(value.fee)) return false;

  return true;
}

export function isTxSubmitRequest(value: unknown): value is TxSubmitRequest {
  if (!isObject(value)) return false;
  return isNonEmptyString(value.signedEnvelopeXdr);
}

export function getSorobanNetworkPassphrase(network: string): string {
  if (network === 'public') {
    return 'Public Global Stellar Network ; September 2015';
  }

  return 'Test SDF Network ; September 2015';
}

export function buildSorobanTransactionRpcRequest(
  request: TxBuildRequest,
  contractId: string,
  network: string,
  options: BuildSorobanTransactionOptions = {},
): Record<string, unknown> {
  const fee = resolveTransactionFee(options);
  return {
    jsonrpc: '2.0',
    id: 'build_soroban_transaction',
    method: 'build_soroban_transaction',
    params: [
      {
        source: request.sourceAccount,
        network_passphrase: getSorobanNetworkPassphrase(network),
        fee,
        instructions: [buildLendingInstruction(request.type, request.data, contractId)],
      },
    ],
  };
}

export function buildSorobanSubmitRpcRequest(
  signedEnvelopeXdr: string,
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: 'send_transaction',
    method: 'send_transaction',
    params: [{ tx: signedEnvelopeXdr }],
  };
}

export function extractUnsignedXdr(response: unknown): string | undefined {
  if (!isObject(response)) return undefined;
  const result = response as SorobanRpcBuildResult;
  return result.transaction ?? result.transaction_xdr;
}

export function extractSubmitResult(response: unknown): SorobanRpcSubmitResult | undefined {
  if (!isObject(response)) return undefined;
  const result = response as SorobanRpcSubmitResult;
  if (result.hash || result.status) return result;
  return undefined;
}

export function buildSorobanRpcError(error: unknown): SorobanRpcError {
  if (!isObject(error)) {
    return { code: 'UNKNOWN_ERROR', message: String(error) };
  }

  return {
    code: coerceErrorCode(error.code),
    message: typeof error.message === 'string' ? error.message : 'Unknown Soroban RPC error',
    data: error.data,
  };
}

export function buildLendingInstruction(
  action: 'lend' | 'borrow',
  data: LendingData,
  contractId: string,
): Record<string, unknown> {
  const args: Array<Record<string, unknown>> = [
    { type: 'string', value: data.asset },
    { type: 'u64', value: data.amount.toString() },
    { type: 'string', value: data.interestRate.toString() },
  ];

  if (action === 'borrow') {
    args.push({ type: 'u32', value: String(data.duration ?? 0) });
    args.push({ type: 'string', value: String(data.collateral ?? '') });
    args.push({ type: 'u64', value: String(data.collateralAmount ?? 0) });
  }

  return {
    type: 'invoke_host_function',
    function: action,
    contract_id: contractId,
    args,
    footprint: {
      read_only: [],
      read_write: [],
    },
  };
}
