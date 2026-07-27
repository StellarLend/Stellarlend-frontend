export const TX_STATUS_POLL = {
  INITIAL_DELAY_MS: 1_000,
  MAX_DELAY_MS: 30_000,
  BACKOFF_MULTIPLIER: 2,
} as const;

export const TX_API_STATUS = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  NOT_FOUND: "NOT_FOUND",
  PENDING: "PENDING",
} as const;

export type TxApiStatus = (typeof TX_API_STATUS)[keyof typeof TX_API_STATUS];

export const TX_HOOK_STATE = {
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  RATE_LIMITED: "rate_limited",
} as const;

export type TxHookState = (typeof TX_HOOK_STATE)[keyof typeof TX_HOOK_STATE];

export const TX_STATUS_ENDPOINT = (hash: string) => `/api/tx/status/${hash}`;

export const isTerminalApiStatus = (status: string | null): boolean =>
  status === TX_API_STATUS.SUCCESS ||
  status === TX_API_STATUS.FAILED ||
  status === TX_API_STATUS.NOT_FOUND;
