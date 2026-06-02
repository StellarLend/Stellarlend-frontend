import config from '@/lib/config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  route: string;
  method?: string;
  status?: number;
  durationMs?: number;
  message: string;
  context?: unknown;
}

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const sensitiveKeyPattern = /authorization|auth|token|password|secret|apiKey|apikey|access_token|refresh_token|privateKey|secretKey/i;
const jwtPattern = /\b(?:Bearer\s+[A-Za-z0-9\-_\.\=]+|eyJ[A-Za-z0-9\-_]+(?:\.[A-Za-z0-9\-_]+){1,2})\b/g;
const stellarAddressPattern = /\bG[A-Z2-7]{55}\b/g;
const stellarSecretPattern = /\bS[A-Z2-7]{55}\b/g;

function getActiveLogLevel(): LogLevel {
  const configured = config.logging?.level;
  if (configured && LOG_LEVELS.includes(configured)) {
    return configured;
  }

  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[getActiveLogLevel()];
}

function redactString(value: string): string {
  return value
    .replace(jwtPattern, '[REDACTED_TOKEN]')
    .replace(stellarSecretPattern, '[REDACTED_SECRET]')
    .replace(stellarAddressPattern, '[REDACTED_ADDRESS]');
}

export function redactSensitiveData(value: unknown, key?: string, seen = new WeakSet()): unknown {
  if (typeof value === 'string') {
    if (key && sensitiveKeyPattern.test(key)) {
      return '[REDACTED]';
    }
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, key, seen));
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      return '[REDACTED]';
    }
    seen.add(value);

    return Object.entries(value).reduce<Record<string, unknown>>((acc, [childKey, childValue]) => {
      acc[childKey] = redactSensitiveData(childValue, childKey, seen);
      return acc;
    }, {});
  }

  return value;
}

function serializeContext(context: unknown): unknown {
  const redacted = redactSensitiveData(context);
  try {
    return JSON.parse(JSON.stringify(redacted));
  } catch {
    return '[UNSERIALIZABLE_CONTEXT]';
  }
}

export function formatLog(entry: Omit<LogEntry, 'timestamp'>): string {
  const log: LogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
    context: entry.context ? serializeContext(entry.context) : undefined,
  };

  return JSON.stringify(log);
}

function emit(level: LogLevel, message: string, route: string, options?: { status?: number; durationMs?: number; context?: unknown }) {
  if (!shouldLog(level)) {
    return;
  }

  const log = formatLog({
    level,
    route,
    message,
    status: options?.status,
    durationMs: options?.durationMs,
    context: options?.context,
  });

  if (level === 'error') {
    console.error(log);
  } else {
    console.log(log);
  }
}

export const logger = {
  debug: (message: string, route: string, context?: unknown) => emit('debug', message, route, { context }),
  info: (message: string, route: string, context?: unknown) => emit('info', message, route, { context }),
  warn: (message: string, route: string, context?: unknown) => emit('warn', message, route, { context }),
  error: (message: string, route: string, context?: unknown) => emit('error', message, route, { context }),
};
