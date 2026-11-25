export const queryKeys = {
  account: (address: string | null | undefined) => ["account", address] as const,
  accountBalance: (address: string | null | undefined) => ["account", address, "balance"] as const,
  contract: (fn: string, ...args: unknown[]) => ["contract", fn, ...args] as const,
  position: (address: string) => ["liquidation", "position", address] as const,
  liquidationParams: () => ["liquidation", "params"] as const,
  /** Live on-chain market parameters (LTV, caps, thresholds). */
  marketParams: () => ["markets", "params"] as const,
  /** On-chain lending position for a connected wallet address. */
  lendingPosition: (address: string | null | undefined) => ["markets", "position", address] as const,
  /** Horizon account balances for a connected wallet address. */
  walletBalances: (address: string | null | undefined) => ["markets", "balances", address] as const,
};

export const qk = queryKeys;
