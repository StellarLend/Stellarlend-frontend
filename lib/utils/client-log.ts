const DEFAULT_CLIENT_LOG_DISABLED = process.env.NEXT_PUBLIC_DISABLE_CLIENT_LOGS === 'true';
const SENSITIVE_KEY_PATTERN = /address|wallet|account|publicKey|privateKey|secret|token|password|apiKey|authorization|auth|balance|amount|fee/i;
const STELLAR_ADDRESS_PATTERN = /^G[A-Za-z0-9]{20,}$/;
const STELLAR_ADDRESS_GLOBAL_PATTERN = /\bG[A-Za-z0-9]{20,}\b/g;
const AMOUNT_PATTERN = /\b(?:\d+(?:\.\d+)?)(?=\s*(?:USD|XLM|USDC|BTC|ETH|amount|fee|balance)\b)/gi;

function isProductionLike(): boolean {
  return process.env.NODE_ENV === 'production' || DEFAULT_CLIENT_LOG_DISABLED;
}

function maskAddress(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return '[REDACTED_ADDRESS]';
  }

  const normalized = trimmed.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const prefix = normalized.slice(0, 4).padEnd(4, 'A');
  const suffix = normalized.slice(-4).padEnd(4, 'A');
  return `${prefix}...${suffix}`;
}

function isStellarAddress(value: string): boolean {
  return STELLAR_ADDRESS_PATTERN.test(value.trim());
}

function redactValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (isStellarAddress(value)) {
      return key && /wallet|publicKey|account/i.test(key) ? '[REDACTED_ADDRESS]' : maskAddress(value);
    }

    if (key && SENSITIVE_KEY_PATTERN.test(key)) {
      return '[REDACTED]';
    }

    const masked = value.replace(STELLAR_ADDRESS_GLOBAL_PATTERN, (address) => maskAddress(address));
    return masked.replace(AMOUNT_PATTERN, '[REDACTED]');
  }

  if (typeof value === 'number') {
    return key && SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [childKey, childValue]) => {
      acc[childKey] = redactValue(childValue, childKey);
      return acc;
    }, {});
  }

  return value;
}

function redactArgs(args: unknown[]): unknown[] {
  return args.map((arg) => redactValue(arg));
}

function shouldEmit(): boolean {
  return !isProductionLike();
}

function emit(level: 'log' | 'info' | 'warn' | 'error', message: unknown, ...args: unknown[]) {
  if (!shouldEmit()) {
    return;
  }

  const redactedArgs = redactArgs(args);
  const resolvedMessage = typeof message === 'string' ? message : redactValue(message);

  if (level === 'error') {
    console.error(resolvedMessage, ...redactedArgs);
  } else if (level === 'warn') {
    console.warn(resolvedMessage, ...redactedArgs);
  } else if (level === 'info') {
    console.info(resolvedMessage, ...redactedArgs);
  } else {
    console.log(resolvedMessage, ...redactedArgs);
  }
}

export const clientLog = {
  log: (message: unknown, ...args: unknown[]) => emit('log', message, ...args),
  info: (message: unknown, ...args: unknown[]) => emit('info', message, ...args),
  warn: (message: unknown, ...args: unknown[]) => emit('warn', message, ...args),
  error: (message: unknown, ...args: unknown[]) => emit('error', message, ...args),
  redact: (value: unknown) => redactValue(value),
};
