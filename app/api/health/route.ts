import { NextRequest, NextResponse } from 'next/server';
import crypto from 'cypto';
import config from '@/lib/config';
import { httpGet } from '@/lib/http';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

export type CheckStatus = 'healthy' | 'degraded';

export interface HealthChecks {
  database: CheckStatus;
  api: CheckStatus;
  stellar: CheckStatus;
}

export interface HealthResponse {
  status: CheckStatus;
  timestamp: string;
  environment: string;
  version: string;
  checks: HealthChecks;
}

/**
 * Health check invariants:
 * 1. Every dependency check must settle to 'healthy' or 'degraded' and must never throw.
 * 2. Overall status is 'healthy' only when all checks are healthy.
 * 3. Responses are deterministic for a given dependency state (ETag derived from body).
 * 4. Failures in one check must not prevent other checks from reporting.
 */

const DEFAULT_SOROBAN_RPC = 'https://private-rpc.test';
const DEFAULT_HORIZON = 'https://horizon-testnet.stellar.org';
const DEFAULT_API_BASE = 'http://localhost:3001';

const HEALTH_TIMEOUT_MS = 5000;
const HEALTH_RETRIES = 1;

function normalizeUrl(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }
  return raw.trim();
}

function joinUrl(base: string, path: string): string {
  const trimmed = base.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${trimmed}/${cleanPath}`;
}

export function resolveSorobanRpcUrl(): string {
  const raw =
    (config.stellar as any)?.sorobanRpcUrl ||
    process.env.SOROBAN_RPC_URL ||
    process.env.STELLAR_SOROBAN_RPC_URL ||
    DEFAULT_SOROBAN_RPC;
  return normalizeUrl(raw, DEFAULT_SOROBAN_RPC);
}

export function resolveHorizonUrl(): string {
  const raw =
    config.stellar.horizonUrl ||
    process.env.STELLAR_HORIZON_URL ||
    process.env.HORIZON_URL ||
    DEFAULT_HORIZON;
  return normalizeUrl(raw, DEFAULT_HORIZON);
}

export function resolveApiBaseUrl(): string {
  const raw = config.api?.baseUrl || process.env.API_BASE_URL || DEFAULT_API_BASE;
  return normalizeUrl(raw, DEFAULT_API_BASE);
}

async function checkSorobanRpc(): Promise<CheckStatus> {
  try {
    const cleanUrl = resolveSorobanRpcUrl().replace(/\/+$/, '');
    await httpGet(`${cleanUrl}/health`, { timeoutMs: HEALTH_TIMEOUT_MS, retries: HEALTH_RETRIES });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

async function checkHorizon(): Promise<CheckStatus> {
  try {
    const cleanUrl = resolveHorizonUrl().replace(/\/+$/, '');
    await httpGet(`${cleanUrl}/`, { timeoutMs: HEALTH_TIMEOUT_MS, retries: HEALTH_RETRIES });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

async function checkApi(): Promise<CheckStatus> {
  try {
    const baseUrl = resolveApiBaseUrl();
    await httpGet(joinUrl(baseUrl, 'health'), {
      timeoutMs: HEALTH_TIMEOUT_MS,
      retries: HEALTH_RETRIES,
    });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

async function checkDatabase(): Promise<CheckStatus> {
  try {
    const baseUrl = resolveApiBaseUrl();
    await httpGet(joinUrl(baseUrl, 'health/db'), {
      timeoutMs: HEALTH_TIMEOUT_MS,
      retries: HEALTH_RETRIES,
    });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

export function computeOverallStatus(checks: HealthChecks): CheckStatus {
  return checks.database === 'healthy' &&
    checks.api === 'healthy' &&
    checks.stellar === 'healthy'
    ? 'healthy'
    : 'degraded';
}

export function computeStellarStatus(
  horizonStatus: CheckStatus,
  sorobanStatus: CheckStatus,
): CheckStatus {
  return horizonStatus === 'healthy' && sorobanStatus === 'healthy'
    ? 'healthy'
    : 'degraded';
}

export function computeEtag(checks: HealthChecks): string {
  const etagBase = JSON.stringify({
    status: computeOverallStatus(checks),
    environment: config.app?.environment ?? 'development',
    version: config.app?.version ?? '1.0.0',
    checks,
  });
  return `${crypto.createHash('md5').update(etagBase).toString('hex')}`;
}

export function buildHealthResponse(checks: HealthChecks): HealthResponse {
  return {
    status: computeOverallStatus(checks),
    timestamp: new Date().toISOString(),
    environment: config.app?.environment ?? 'development',
    version: config.app?.version ?? '1.0.0',
    checks,
  };
}

export function buildDegradedResponse(): HealthResponse {
  return {
    status: 'degraded',
    timestamp: new Date().toISOString(),
    environment: config.app?.environment ?? 'development',
    version: config.app?.version ?? '1.0.0',
    checks: {
      database: 'degraded',
      api: 'degraded',
      stellar: 'degraded',
    },
  };
}

export function buildHealthHeaders(etag: string): Headers {
  return new Headers({
    'Cache-Control': 'public, max-age=30',
    ETag: etag,
    Vary: 'Accept-Encoding',
  });
}

export function isNotModified(ifNoneMatch: string | null, etag: string): boolean {
  return Boolean(ifNoneMatch && ifNoneMatch === etag);
}

export async function runHealthChecks(): Promise<HealthChecks> {
  // Run checks in parallel so a slow or failing dependency cannot block the others.
  // Each check is individually guarded and resolves to a status, never rejects.
  const [sorobanStatus, horizonStatus, apiStatus, dbStatus] = await Promise.all([
    checkSorobanRpc(),
    checkHorizon(),
    checkApi(),
    checkDatabase(),
  ]);

  return {
    database: dbStatus,
    api: apiStatus,
    stellar: computeStellarStatus(horizonStatus, sorobanStatus),
  };
}

async function handleHealth(request: NextRequest) {
  try {
    const checks = await runHealthChecks();
    const etag = computeEtag(checks);
    const ifNoneMatch = request?.headers?.get('if-none-match') ?? null;

    const headers = buildHealthHeaders(etag);

    if (isNotModified(ifNoneMatch, etag)) {
      return new NextResponse(null, { status: 304, headers });
    }

    const healthData = buildHealthResponse(checks);

    headers.set('Content-Type', 'application/json');

    return new NextResponse(JSON.stringify(healthData), {
      status: 200,
      headers,
    });
  } catch {
    // Last-resort guard: never leak internal error details to the client.
    // Return a deterministic degraded response with no-store caching.
    const fallback = buildDegradedResponse();
    return new NextResponse(JSON.stringify(fallback), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
}

export const GET = withRequestLogging('/api/health', handleHealth);
