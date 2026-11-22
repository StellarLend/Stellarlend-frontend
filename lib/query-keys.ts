export const queryKeys = {
  account: (address: string | null | undefined) => ["account", address] as const,
  accountBalance: (address: string | null | undefined) => ["account", address, "balance"] as const,
  contract: (fn: string, ...args: unknown[]) => ["contract", fn, ...args] as const,
};

export const qk = queryKeys;
