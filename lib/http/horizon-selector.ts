import { metrics } from '@/lib/metrics/registry';

const DEFAULT_ERROR_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_OPEN_MS = 30 * 1000; // 30 seconds
const MIN_EFFECTIVE_WEIGHT = 0.1;

export interface HorizonEndpoint {
  url: string;
  host: string;
}

interface EndpointState extends HorizonEndpoint {
  currentWeight: number;
  successes: number[];
  failures: number[];
  lastFailureAt: number | null;
}

function normalizeHorizonUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error(`Invalid Horizon URL: ${rawUrl}`);
  }
}

function pruneWindow(records: number[], now: number, windowMs: number): number[] {
  return records.filter((timestamp) => now - timestamp <= windowMs);
}

export class HorizonSelector {
  private endpoints: EndpointState[];

  constructor(urls: string[]) {
    if (!urls.length) {
      throw new Error('HorizonSelector requires at least one Horizon endpoint URL');
    }

    const normalizedUrls = Array.from(
      new Set(urls.map((url) => normalizeHorizonUrl(url))),
    );

    if (!normalizedUrls.length) {
      throw new Error('HorizonSelector requires at least one valid Horizon endpoint URL');
    }

    this.endpoints = normalizedUrls.map((url) => ({
      url,
      host: new URL(url).host,
      currentWeight: 0,
      successes: [],
      failures: [],
      lastFailureAt: null,
    }));
  }

  selectEndpoint(): HorizonEndpoint {
    const now = Date.now();
    let totalWeight = 0;

    for (const endpoint of this.endpoints) {
      endpoint.successes = pruneWindow(endpoint.successes, now, DEFAULT_ERROR_WINDOW_MS);
      endpoint.failures = pruneWindow(endpoint.failures, now, DEFAULT_ERROR_WINDOW_MS);

      const failureCount = endpoint.failures.length;
      const successCount = endpoint.successes.length;
      const isTripped =
        failureCount >= CIRCUIT_BREAKER_FAILURE_THRESHOLD &&
        endpoint.lastFailureAt !== null &&
        now - endpoint.lastFailureAt < CIRCUIT_BREAKER_OPEN_MS;

      const errorRate =
        successCount + failureCount === 0 ? 0 : failureCount / (successCount + failureCount);
      const effectiveWeight = isTripped
        ? 0
        : Math.max(MIN_EFFECTIVE_WEIGHT, 1 - errorRate);

      endpoint.currentWeight += effectiveWeight;
      totalWeight += effectiveWeight;
    }

    let selected = this.endpoints[0];
    for (const endpoint of this.endpoints) {
      if (endpoint.currentWeight > selected.currentWeight) {
        selected = endpoint;
      }
    }

    if (totalWeight > 0) {
      selected.currentWeight -= totalWeight;
    }

    metrics.horizonSelections.inc({ host: selected.host });
    return { url: selected.url, host: selected.host };
  }

  recordSuccess(url: string): void {
    const endpoint = this.endpoints.find((entry) => entry.url === normalizeHorizonUrl(url));
    if (!endpoint) return;
    endpoint.successes.push(Date.now());
  }

  recordFailure(url: string): void {
    const endpoint = this.endpoints.find((entry) => entry.url === normalizeHorizonUrl(url));
    if (!endpoint) return;
    endpoint.failures.push(Date.now());
    endpoint.lastFailureAt = Date.now();
  }

  getUrls(): string[] {
    return this.endpoints.map((endpoint) => endpoint.url);
  }

  reset(): void {
    this.endpoints.forEach((endpoint) => {
      endpoint.currentWeight = 0;
      endpoint.successes = [];
      endpoint.failures = [];
      endpoint.lastFailureAt = null;
    });
  }
}
