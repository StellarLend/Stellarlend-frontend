// lib/http/circuit-breaker.ts

import { CIRCUIT_FAILURE_RATE, CIRCUIT_MIN_CALLS, CIRCUIT_COOLDOWN_MS } from '@/lib/server-config';
import { metrics } from '@/lib/metrics/registry';

/** Simple enum for circuit breaker states */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

interface HostStats {
  host: string;
  successes: number;
  failures: number;
  state: CircuitState;
  openedAt?: number; // timestamp when opened
}

/** CircuitBreaker tracks per‑host request outcomes and decides whether to allow a request. */
export class CircuitBreaker {
  private hostMap = new Map<string, HostStats>();

  private now(): number {
    return Date.now();
  }

  private getStats(host: string): HostStats {
    let stats = this.hostMap.get(host);
    if (!stats) {
      stats = { host, successes: 0, failures: 0, state: CircuitState.CLOSED };
      this.hostMap.set(host, stats);
    }
    return stats;
  }

  /** Returns true if the request should proceed. Skips breaker for health probes. */
  shouldAllow(host: string, path: string): boolean {
    if (path.startsWith('/api/health')) return true;
    const stats = this.getStats(host);
    this.transitionIfNeeded(stats);
    return stats.state !== CircuitState.OPEN;
  }

  recordSuccess(host: string) {
    const stats = this.getStats(host);
    stats.successes++;
    if (stats.state === CircuitState.HALF_OPEN) {
      // Successful trial closes the circuit
      this.setState(stats, CircuitState.CLOSED);
    }
    this.transitionIfNeeded(stats);
  }

  recordFailure(host: string) {
    const stats = this.getStats(host);
    stats.failures++;
    this.transitionIfNeeded(stats);
  }

  private setState(stats: HostStats, newState: CircuitState) {
    stats.state = newState;
    if (newState === CircuitState.CLOSED) {
      stats.successes = 0;
      stats.failures = 0;
      stats.openedAt = undefined;
    }
    if (newState === CircuitState.OPEN) {
      stats.openedAt = this.now();
    }
    // Update Prometheus gauge (0=closed,1=open,2=half_open)
    const stateValue = newState === CircuitState.CLOSED ? 0 : newState === CircuitState.OPEN ? 1 : 2;
    metrics.circuitState.set({ host: stats.host }, stateValue);
  }

  private transitionIfNeeded(stats: HostStats) {
    const total = stats.successes + stats.failures;
    if (total < CIRCUIT_MIN_CALLS) return;
    const failureRate = stats.failures / total;
    if (stats.state === CircuitState.CLOSED && failureRate >= CIRCUIT_FAILURE_RATE) {
      this.setState(stats, CircuitState.OPEN);
      return;
    }
    if (stats.state === CircuitState.OPEN && stats.openedAt !== undefined) {
      if (this.now() - stats.openedAt >= CIRCUIT_COOLDOWN_MS) {
        this.setState(stats, CircuitState.HALF_OPEN);
      }
    }
  }
}

// Export a singleton for application-wide usage
export const circuitBreaker = new CircuitBreaker();
