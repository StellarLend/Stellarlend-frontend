import { xdr } from '@stellar/stellar-sdk';
import { httpPost } from '@/lib/http/client';
import {
  HttpError,
  NetworkError,
  RetryExhaustedError,
  TimeoutError,
  UpstreamHttpError,
} from '@/lib/http/errors';
import { buildSorobanRpcError, SorobanRpcError } from './tx';

type SimulationErrorCode =
  | 'RESTORE_REQUIRED'
  | 'AUTH_REQUIRED'
  | 'SIMULATION_FAILED'
  | 'SIMULATION_UNAVAILABLE';

type SorobanSimulationRpcEnvelope = {
  result?: unknown;
  error?: unknown;
};

type SorobanSimulationResources = {
  footprint?: unknown;
  transactionData?: unknown;
  transaction_data?: unknown;
  minResourceFee?: unknown;
  min_resource_fee?: unknown;
  results?: unknown;
  restorePreamble?: unknown;
  restore_preamble?: unknown;
};

export interface SorobanSimulationFootprint {
  readOnly: string[];
  readWrite: string[];
}

export interface SorobanSimulationResult {
  transactionDataXdr: string;
  minResourceFee: string;
  footprint: SorobanSimulationFootprint;
  auth: string[];
}

export class SorobanSimulationError extends Error {
  constructor(
    public readonly code: SimulationErrorCode,
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SorobanSimulationError';
  }
}

const RESTORE_ERROR_MESSAGE =
  'This transaction requires a restore before it can be submitted.';
const AUTH_ERROR_MESSAGE =
  'This transaction requires additional authorization before it can be submitted.';
const SIMULATION_FAILURE_MESSAGE =
  'Transaction simulation failed. Review the transaction details and try again.';
const SIMULATION_UNAVAILABLE_MESSAGE =
  'Unable to simulate the transaction right now. Please try again later.';

const RESTORE_PATTERN = /(restore|archived|expired.*footprint|restorepreamble)/i;
const AUTH_PATTERN = /(auth|authorization|signature|missing.*authoriz)/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function readString(
  value: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return undefined;
}

function buildSimulationRequest(transactionXdr: string): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: 'simulate_transaction',
    method: 'simulateTransaction',
    params: [{ transaction: transactionXdr }],
  };
}

function extractAuthEntries(result: Record<string, unknown>): string[] {
  const authEntries = new Set<string>();
  const results = Array.isArray(result.results) ? result.results : [];

  for (const item of results) {
    if (!isObject(item) || !Array.isArray(item.auth)) {
      continue;
    }

    for (const authEntry of item.auth) {
      if (isString(authEntry)) {
        authEntries.add(authEntry);
      }
    }
  }

  return [...authEntries];
}

function parseFootprintFromTransactionData(transactionDataXdr: string): SorobanSimulationFootprint {
  try {
    const transactionData = xdr.SorobanTransactionData.fromXDR(transactionDataXdr, 'base64');
    const footprint = transactionData.resources().footprint();

    return {
      readOnly: footprint.readOnly().map((ledgerKey) => ledgerKey.toXDR('base64')),
      readWrite: footprint.readWrite().map((ledgerKey) => ledgerKey.toXDR('base64')),
    };
  } catch {
    return {
      readOnly: [],
      readWrite: [],
    };
  }
}

function normalizeFootprint(
  rawFootprint: unknown,
  transactionDataXdr: string,
): SorobanSimulationFootprint {
  if (isObject(rawFootprint)) {
    const readOnlySource =
      Array.isArray(rawFootprint.readOnly)
        ? rawFootprint.readOnly
        : Array.isArray(rawFootprint.read_only)
        ? rawFootprint.read_only
        : [];
    const readWriteSource =
      Array.isArray(rawFootprint.readWrite)
        ? rawFootprint.readWrite
        : Array.isArray(rawFootprint.read_write)
        ? rawFootprint.read_write
        : [];
    const readOnly = Array.isArray(readOnlySource)
      ? readOnlySource.filter(isString)
      : [];
    const readWrite = Array.isArray(readWriteSource)
      ? readWriteSource.filter(isString)
      : [];

    return { readOnly, readWrite };
  }

  return parseFootprintFromTransactionData(transactionDataXdr);
}

function buildRestoreError(data?: unknown): SorobanSimulationError {
  return new SorobanSimulationError(
    'RESTORE_REQUIRED',
    RESTORE_ERROR_MESSAGE,
    409,
    {
      restoreRequired: true,
      restorePreamble: data,
    },
  );
}

function mapRpcSimulationError(error: unknown): SorobanSimulationError {
  const rpcError = buildSorobanRpcError(error);
  const detailsText = [rpcError.message, JSON.stringify(rpcError.data ?? null)].join(' ');
  const restorePreamble =
    isObject(rpcError.data) && 'restorePreamble' in rpcError.data
      ? rpcError.data.restorePreamble
      : isObject(rpcError.data) && 'restore_preamble' in rpcError.data
      ? rpcError.data.restore_preamble
      : undefined;

  if (restorePreamble !== undefined || RESTORE_PATTERN.test(detailsText)) {
    return buildRestoreError(restorePreamble ?? rpcError.data);
  }

  if (AUTH_PATTERN.test(detailsText)) {
    return new SorobanSimulationError(
      'AUTH_REQUIRED',
      AUTH_ERROR_MESSAGE,
      422,
      { authRequired: true },
    );
  }

  return new SorobanSimulationError(
    'SIMULATION_FAILED',
    SIMULATION_FAILURE_MESSAGE,
    422,
  );
}

function mapTransportSimulationError(error: unknown): SorobanSimulationError {
  if (
    error instanceof TimeoutError ||
    error instanceof NetworkError ||
    error instanceof UpstreamHttpError ||
    error instanceof RetryExhaustedError ||
    error instanceof HttpError
  ) {
    return new SorobanSimulationError(
      'SIMULATION_UNAVAILABLE',
      SIMULATION_UNAVAILABLE_MESSAGE,
      502,
      undefined,
      error,
    );
  }

  return new SorobanSimulationError(
    'SIMULATION_FAILED',
    SIMULATION_FAILURE_MESSAGE,
    422,
    undefined,
    error,
  );
}

function parseSimulationResult(response: unknown): SorobanSimulationResult {
  if (!isObject(response)) {
    throw new SorobanSimulationError(
      'SIMULATION_FAILED',
      SIMULATION_FAILURE_MESSAGE,
      422,
    );
  }

  if ('error' in response && response.error !== undefined) {
    throw mapRpcSimulationError(response.error);
  }

  const result = response as SorobanSimulationResources;
  const restorePreamble = result.restorePreamble ?? result.restore_preamble;
  if (restorePreamble !== undefined) {
    throw buildRestoreError(restorePreamble);
  }

  const transactionDataXdr =
    readString(result as Record<string, unknown>, 'transactionData', 'transaction_data');
  const minResourceFee =
    readString(result as Record<string, unknown>, 'minResourceFee', 'min_resource_fee');

  if (!transactionDataXdr || !minResourceFee) {
    throw new SorobanSimulationError(
      'SIMULATION_FAILED',
      SIMULATION_FAILURE_MESSAGE,
      422,
    );
  }

  return {
    transactionDataXdr,
    minResourceFee,
    footprint: normalizeFootprint(result.footprint, transactionDataXdr),
    auth: extractAuthEntries(result as Record<string, unknown>),
  };
}

export async function simulateSorobanTransaction(
  rpcUrl: string,
  transactionXdr: string,
): Promise<SorobanSimulationResult> {
  try {
    const rpcResponse = await httpPost<SorobanSimulationRpcEnvelope>(
      rpcUrl,
      buildSimulationRequest(transactionXdr),
      { timeoutMs: 10000 },
    );

    if (isObject(rpcResponse) && 'error' in rpcResponse && rpcResponse.error !== undefined) {
      throw mapRpcSimulationError(rpcResponse.error);
    }

    return parseSimulationResult(
      isObject(rpcResponse) && 'result' in rpcResponse ? rpcResponse.result : rpcResponse,
    );
  } catch (error) {
    if (error instanceof SorobanSimulationError) {
      throw error;
    }

    throw mapTransportSimulationError(error);
  }
}

export function buildSorobanSimulationApiError(error: unknown): SorobanRpcError {
  if (error instanceof SorobanSimulationError) {
    const apiError: SorobanRpcError = {
      code: error.code,
      message: error.message,
    };

    if (error.data !== undefined) {
      apiError.data = error.data;
    }

    return apiError;
  }

  return {
    code: 'SIMULATION_FAILED',
    message: SIMULATION_FAILURE_MESSAGE,
  };
}

export function getSorobanSimulationStatus(error: unknown): number {
  if (error instanceof SorobanSimulationError) {
    return error.status;
  }

  return 502;
}
