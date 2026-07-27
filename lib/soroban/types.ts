export interface SorobanRpcError {
  code: number | string;
  message: string;
  data?: unknown;
}

export interface SorobanRpcSuccessResponse {
  jsonrpc: '2.0';
  id: string;
  result: unknown;
  error?: never;
}

export interface SorobanRpcErrorResponse {
  jsonrpc: '2.0';
  id: string;
  error: SorobanRpcError;
  result?: never;
}

export type SorobanRpcResponse = SorobanRpcSuccessResponse | SorobanRpcErrorResponse;

export function isSorobanRpcErrorResponse(
  response: unknown,
): response is SorobanRpcErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as Record<string, unknown>).error === 'object' &&
    (response as Record<string, unknown>).error !== null
  );
}

export function isSorobanRpcSuccessResponse(
  response: unknown,
): response is SorobanRpcSuccessResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'result' in response &&
    !('error' in response && (response as Record<string, unknown>).error != null)
  );
}
