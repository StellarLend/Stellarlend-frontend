import { AllEndpointsUnhealthyError } from './errors';

export interface EndpointConfig {
  url: string;
  /** Relative weight for selection (higher = preferred). Default 1. */
  weight?: number;
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before tripping an endpoint. Default 3. */
  failureThreshold?: number;
  /** Milliseconds the circuit stays open before allowing a half-open probe. Default 30 000. */
  openMs?: number;
}

interface InternalEndpoint {
  url: string;
  weight: number;
  effectiveWeight: number;
  failureCount: number;
  lastFailureAt: number;
  tripped: boolean;
}

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_OPEN_MS = 30_000;

export class HorizonSelector {
  private readonly endpoints: InternalEndpoint[];
  private readonly failureThreshold: number;
  private readonly openMs: number;

  constructor(
    endpoints: EndpointConfig[],
    options?: CircuitBreakerOptions,
  ) {
    if (endpoints.length === 0) {
      throw new Error('HorizonSelector requires at least one endpoint');
    }

    this.failureThreshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.openMs = options?.openMs ?? DEFAULT_OPEN_MS;

    this.endpoints = endpoints.map((ep) => ({
      url: ep.url,
      weight: ep.weight ?? 1,
      effectiveWeight: ep.weight ?? 1,
      failureCount: 0,
      lastFailureAt: 0,
      tripped: false,
    }));
  }

  /**
   * Select the best available endpoint using weighted random selection.
   *
   * Throws `AllEndpointsUnhealthyError` when every configured endpoint is
   * currently tripped (circuit breaker open).
   */
  selectEndpoint(): string {
    this.recoverHalfOpenEndpoints();

    const available = this.endpoints.filter((ep) => !ep.tripped);

    if (available.length === 0) {
      throw new AllEndpointsUnhealthyError(this.endpoints.length);
    }

    const totalWeight = available.reduce((sum, ep) => sum + ep.effectiveWeight, 0);
    let random = Math.random() * totalWeight;

    for (const ep of available) {
      random -= ep.effectiveWeight;
      if (random <= 0) {
        return ep.url;
      }
    }

    return available[available.length - 1].url;
  }

  /**
   * Record a successful request — resets the failure count and restores
   * the endpoint's effective weight.
   */
  recordSuccess(url: string): void {
    const ep = this.findEndpoint(url);
    if (!ep) return;
    ep.failureCount = 0;
    ep.tripped = false;
    ep.effectiveWeight = ep.weight;
  }

  /**
   * Record a failed request — increments the failure count and, once the
   * threshold is crossed, trips the endpoint (opens the circuit).
   */
  recordFailure(url: string): void {
    const ep = this.findEndpoint(url);
    if (!ep) return;

    ep.failureCount += 1;
    ep.lastFailureAt = Date.now();

    if (ep.failureCount >= this.failureThreshold) {
      ep.tripped = true;
      ep.effectiveWeight = 0;
    }
  }

  /** Return a snapshot of every endpoint's current health status. */
  getStatus(): Array<{
    url: string;
    weight: number;
    effectiveWeight: number;
    failureCount: number;
    tripped: boolean;
  }> {
    this.recoverHalfOpenEndpoints();
    return this.endpoints.map((ep) => ({
      url: ep.url,
      weight: ep.weight,
      effectiveWeight: ep.effectiveWeight,
      failureCount: ep.failureCount,
      tripped: ep.tripped,
    }));
  }

  // ── internals ──────────────────────────────────────────────────────

  /**
   * If an endpoint's circuit has been open longer than `openMs`, allow a
   * single half-open probe by untripping it and restoring minimal weight.
   */
  private recoverHalfOpenEndpoints(): void {
    const now = Date.now();
    for (const ep of this.endpoints) {
      if (ep.tripped && now - ep.lastFailureAt >= this.openMs) {
        ep.tripped = false;
        ep.effectiveWeight = 1;
      }
    }
  }

  private findEndpoint(url: string): InternalEndpoint | undefined {
    return this.endpoints.find((ep) => ep.url === url);
  }
}
