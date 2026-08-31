import { z } from 'zod';

export const SorobanRpcErrorSchema = z.object({
  code: z.union([z.number(), z.string()]),
  message: z.string(),
  data: z.unknown().optional(),
});
export type SorobanRpcError = z.infer<typeof SorobanRpcErrorSchema>;

export const SorobanRpcSuccessResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.string(),
  result: z.unknown(),
  error: z.undefined().optional(),
});
export type SorobanRpcSuccessResponse = z.infer<typeof SorobanRpcSuccessResponseSchema>;

export const SorobanRpcErrorResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.string(),
  error: SorobanRpcErrorSchema,
  result: z.undefined().optional(),
});
export type SorobanRpcErrorResponse = z.infer<typeof SorobanRpcErrorResponseSchema>;

export const SorobanRpcResponseSchema = z.union([
  SorobanRpcSuccessResponseSchema,
  SorobanRpcErrorResponseSchema,
]);

export type SorobanRpcResponse = z.infer<typeof SorobanRpcResponseSchema>;

export function isSorobanRpcErrorResponse(
  response: SorobanRpcResponse,
): response is SorobanRpcErrorResponse {
  return response != null && typeof response === 'object' && 'error' in response && response.error !== undefined && response.error !== null;
}

export function isSorobanRpcSuccessResponse(
  response: SorobanRpcResponse,
): response is SorobanRpcSuccessResponse {
  return response != null && typeof response === 'object' && 'result' in response && response.result !== undefined;
}
