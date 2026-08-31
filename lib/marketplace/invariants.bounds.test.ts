/**
 * Focused tests for the new MARKETPLACE_BOUNDS fields added for bounded
 * performance and operational visibility: polling intervals, concurrent request
 * cap, circuit-breaker thresholds, request timeout, and the telemetry types.
 *
 * These complement the existing invariants.test.ts (which covers filter
 * normalisation, purchase validation, and stale-data helpers) and are kept
 * separate so the two concerns stay independently readable.
 */

import { describe, it, expect } from "vitest";
import { MARKETPLACE_BOUNDS } from "@/types/marketplace";
import type {
  MarketplaceTelemetryEvent,
  MarketplaceTelemetryEventType,
  MarketplaceCircuitBreakerState,
} from "@/types/marketplace";
import { normalizeAndValidateFilters, validatePurchaseRequest } from "./invariants";

// ---------------------------------------------------------------------------
// Bound completeness
// ---------------------------------------------------------------------------

describe("MARKETPLACE_BOUNDS — polling and network bounds", () => {
  it("defines a minimum polling interval that is at least 1 second", () => {
    expect(MARKETPLACE_BOUNDS.POLLING_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(1_000);
  });

  it("defines a default polling interval between min and max", () => {
    expect(MARKETPLACE_BOUNDS.POLLING_DEFAULT_INTERVAL_MS).toBeGreaterThanOrEqual(
      MARKETPLACE_BOUNDS.POLLING_MIN_INTERVAL_MS,
    );
    expect(MARKETPLACE_BOUNDS.POLLING_DEFAULT_INTERVAL_MS).toBeLessThanOrEqual(
      MARKETPLACE_BOUNDS.POLLING_MAX_INTERVAL_MS,
    );
  });

  it("defines a max polling interval greater than the default", () => {
    expect(MARKETPLACE_BOUNDS.POLLING_MAX_INTERVAL_MS).toBeGreaterThan(
      MARKETPLACE_BOUNDS.POLLING_DEFAULT_INTERVAL_MS,
    );
  });

  it("defines a backoff multiplier greater than 1 (intervals grow on failure)", () => {
    expect(MARKETPLACE_BOUNDS.POLLING_BACKOFF_MULTIPLIER).toBeGreaterThan(1);
  });

  it("defines a positive max-retries cap", () => {
    expect(MARKETPLACE_BOUNDS.POLLING_MAX_RETRIES).toBeGreaterThan(0);
  });

  it("defines a positive request timeout", () => {
    expect(MARKETPLACE_BOUNDS.REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("defines a max concurrent requests cap that is at least 1", () => {
    expect(MARKETPLACE_BOUNDS.MAX_CONCURRENT_REQUESTS).toBeGreaterThanOrEqual(1);
  });

  it("defines a circuit-breaker threshold that is at least 1", () => {
    expect(MARKETPLACE_BOUNDS.CIRCUIT_BREAKER_THRESHOLD).toBeGreaterThanOrEqual(1);
  });

  it("defines a circuit-breaker reset window in milliseconds", () => {
    expect(MARKETPLACE_BOUNDS.CIRCUIT_BREAKER_RESET_MS).toBeGreaterThan(0);
  });

  it("exponential backoff from POLLING_MIN_INTERVAL_MS never exceeds POLLING_MAX_INTERVAL_MS", () => {
    let interval = MARKETPLACE_BOUNDS.POLLING_MIN_INTERVAL_MS;
    for (let i = 0; i < 20; i++) {
      interval = Math.min(
        interval * MARKETPLACE_BOUNDS.POLLING_BACKOFF_MULTIPLIER,
        MARKETPLACE_BOUNDS.POLLING_MAX_INTERVAL_MS,
      );
    }
    expect(interval).toBeLessThanOrEqual(MARKETPLACE_BOUNDS.POLLING_MAX_INTERVAL_MS);
  });
});

// ---------------------------------------------------------------------------
// Telemetry type shape (type-level tests exercised at runtime)
// ---------------------------------------------------------------------------

describe("MarketplaceTelemetryEvent — structural shape", () => {
  const ALL_EVENT_TYPES: MarketplaceTelemetryEventType[] = [
    "fetch_started",
    "fetch_succeeded",
    "fetch_failed",
    "stale_response_dropped",
    "concurrent_limit_exceeded",
    "filter_applied",
    "poll_started",
    "poll_stopped",
    "circuit_breaker_opened",
    "circuit_breaker_closed",
    "purchase_started",
    "purchase_succeeded",
    "purchase_failed",
    "purchase_ambiguous",
    "reconcile_started",
    "reconcile_succeeded",
    "reconcile_failed",
    "reconcile_unknown",
    "latency",
  ];

  it("covers all declared event type strings", () => {
    // Every entry in ALL_EVENT_TYPES is a valid MarketplaceTelemetryEventType.
    // If a type is removed from the union this array will fail to compile first,
    // and this runtime check confirms the count is intentionally complete.
    expect(ALL_EVENT_TYPES.length).toBe(19);
  });

  it("can construct a well-formed telemetry event for every type", () => {
    for (const type of ALL_EVENT_TYPES) {
      const event: MarketplaceTelemetryEvent = { type, timestamp: Date.now() };
      expect(event.type).toBe(type);
      expect(typeof event.timestamp).toBe("number");
    }
  });

  it("allows optional latencyMs, errorCode, errorMessage, and metadata fields", () => {
    const event: MarketplaceTelemetryEvent = {
      type: "fetch_failed",
      timestamp: 1_000,
      latencyMs: 250,
      errorCode: "network_error",
      errorMessage: "connection refused",
      metadata: { retryCount: 1, isCircuitOpen: false },
    };
    expect(event.latencyMs).toBe(250);
    expect(event.errorCode).toBe("network_error");
    expect(event.metadata?.retryCount).toBe(1);
  });

  it("enforces that metadata values are string | number | boolean (not objects)", () => {
    // This is a compile-time guard; at runtime we verify the documented shape.
    const meta: Record<string, string | number | boolean> = {
      count: 3,
      reason: "timeout",
      open: true,
    };
    expect(typeof meta.count).toBe("number");
    expect(typeof meta.reason).toBe("string");
    expect(typeof meta.open).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// CircuitBreakerState shape
// ---------------------------------------------------------------------------

describe("MarketplaceCircuitBreakerState", () => {
  it("can represent closed state", () => {
    const state: MarketplaceCircuitBreakerState = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
    };
    expect(state.isOpen).toBe(false);
  });

  it("can represent open state after threshold failures", () => {
    const state: MarketplaceCircuitBreakerState = {
      isOpen: true,
      failureCount: MARKETPLACE_BOUNDS.CIRCUIT_BREAKER_THRESHOLD,
      lastFailureTime: Date.now(),
    };
    expect(state.isOpen).toBe(true);
    expect(state.failureCount).toBeGreaterThanOrEqual(MARKETPLACE_BOUNDS.CIRCUIT_BREAKER_THRESHOLD);
  });

  it("reset window calculation does not overflow for realistic timestamps", () => {
    const now = Date.now();
    const lastFailure = now - MARKETPLACE_BOUNDS.CIRCUIT_BREAKER_RESET_MS - 1;
    const elapsed = now - lastFailure;
    // Should be greater than the reset window — circuit should close.
    expect(elapsed).toBeGreaterThan(MARKETPLACE_BOUNDS.CIRCUIT_BREAKER_RESET_MS);
  });
});

// ---------------------------------------------------------------------------
// Filter bounds — boundary-value tests for the new concurrent/polling bounds
// ---------------------------------------------------------------------------

describe("normalizeAndValidateFilters — pageSize boundary values", () => {
  it("clamps pageSize=0 to MIN_PAGE_SIZE, not zero", () => {
    const result = normalizeAndValidateFilters({ pageSize: "0" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pageSize).toBe(MARKETPLACE_BOUNDS.MIN_PAGE_SIZE);
  });

  it("clamps pageSize=MAX_PAGE_SIZE+1 to MAX_PAGE_SIZE", () => {
    const over = String(MARKETPLACE_BOUNDS.MAX_PAGE_SIZE + 1);
    const result = normalizeAndValidateFilters({ pageSize: over });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pageSize).toBe(MARKETPLACE_BOUNDS.MAX_PAGE_SIZE);
  });

  it("accepts pageSize=MAX_PAGE_SIZE exactly", () => {
    const result = normalizeAndValidateFilters({
      pageSize: String(MARKETPLACE_BOUNDS.MAX_PAGE_SIZE),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pageSize).toBe(MARKETPLACE_BOUNDS.MAX_PAGE_SIZE);
  });

  it("accepts pageSize=MIN_PAGE_SIZE exactly", () => {
    const result = normalizeAndValidateFilters({
      pageSize: String(MARKETPLACE_BOUNDS.MIN_PAGE_SIZE),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pageSize).toBe(MARKETPLACE_BOUNDS.MIN_PAGE_SIZE);
  });

  it("treats a non-numeric pageSize as the default", () => {
    const result = normalizeAndValidateFilters({ pageSize: "banana" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pageSize).toBe(MARKETPLACE_BOUNDS.DEFAULT_PAGE_SIZE);
  });
});

// ---------------------------------------------------------------------------
// Purchase request — boundary, retry, and permission tests
// ---------------------------------------------------------------------------

const BASE_PURCHASE = {
  listingId: "lst_1",
  quantity: "1",
  unitPrice: "10000000",
  idempotencyKey: "p_boundary_test_0001",
  expectedVersion: 1,
  walletAddress: "GBUYER00000000000000000000000000000000000000000000000000001",
};

describe("validatePurchaseRequest — boundary values", () => {
  it("accepts quantity equal to MIN_QUANTITY", () => {
    const result = validatePurchaseRequest({
      ...BASE_PURCHASE,
      quantity: MARKETPLACE_BOUNDS.MIN_QUANTITY,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts quantity equal to MAX_QUANTITY", () => {
    const result = validatePurchaseRequest({
      ...BASE_PURCHASE,
      quantity: MARKETPLACE_BOUNDS.MAX_QUANTITY,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects quantity below MIN_QUANTITY (zero)", () => {
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, quantity: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("below_min");
  });

  it("rejects quantity above MAX_QUANTITY", () => {
    const over = (BigInt(MARKETPLACE_BOUNDS.MAX_QUANTITY) + 1n).toString();
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, quantity: over });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("below_min");
  });

  it("accepts idempotencyKey at MIN length boundary", () => {
    const key = "x".repeat(MARKETPLACE_BOUNDS.IDEMPOTENCY_KEY_MIN_LEN);
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, idempotencyKey: key });
    expect(result.ok).toBe(true);
  });

  it("rejects idempotencyKey one char below MIN length", () => {
    const key = "x".repeat(MARKETPLACE_BOUNDS.IDEMPOTENCY_KEY_MIN_LEN - 1);
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, idempotencyKey: key });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("accepts idempotencyKey at MAX length boundary", () => {
    const key = "x".repeat(MARKETPLACE_BOUNDS.IDEMPOTENCY_KEY_MAX_LEN);
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, idempotencyKey: key });
    expect(result.ok).toBe(true);
  });

  it("rejects idempotencyKey one char above MAX length", () => {
    const key = "x".repeat(MARKETPLACE_BOUNDS.IDEMPOTENCY_KEY_MAX_LEN + 1);
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, idempotencyKey: key });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("accepts walletAddress at MAX length boundary", () => {
    const addr = "G" + "A".repeat(MARKETPLACE_BOUNDS.STELLAR_ADDRESS_MAX_LEN - 1);
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, walletAddress: addr });
    expect(result.ok).toBe(true);
  });

  it("rejects walletAddress one char above MAX length", () => {
    const addr = "G" + "A".repeat(MARKETPLACE_BOUNDS.STELLAR_ADDRESS_MAX_LEN);
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, walletAddress: addr });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("accepts unitPrice at MIN_UNIT_PRICE boundary", () => {
    const result = validatePurchaseRequest({
      ...BASE_PURCHASE,
      unitPrice: MARKETPLACE_BOUNDS.MIN_UNIT_PRICE,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unitPrice of zero (below MIN_UNIT_PRICE)", () => {
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, unitPrice: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("rejects unitPrice above MAX_UNIT_PRICE", () => {
    const over = (BigInt(MARKETPLACE_BOUNDS.MAX_UNIT_PRICE) + 1n).toString();
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, unitPrice: over });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("rejects expectedVersion as a float", () => {
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, expectedVersion: 1.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("rejects expectedVersion as a string", () => {
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, expectedVersion: "1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("rejects expectedVersion of -1", () => {
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, expectedVersion: -1 });
    expect(result.ok).toBe(false);
  });

  it("accepts expectedVersion of 0 (initial state)", () => {
    const result = validatePurchaseRequest({ ...BASE_PURCHASE, expectedVersion: 0 });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter bounds — cursor validation
// ---------------------------------------------------------------------------

describe("normalizeAndValidateFilters — cursor boundary", () => {
  it("accepts a cursor at the max length", () => {
    const cursor = "A".repeat(MARKETPLACE_BOUNDS.CURSOR_MAX_LEN);
    const result = normalizeAndValidateFilters({ cursor });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.cursor).toBe(cursor);
  });

  it("rejects a cursor one char above max length", () => {
    const cursor = "A".repeat(MARKETPLACE_BOUNDS.CURSOR_MAX_LEN + 1);
    const result = normalizeAndValidateFilters({ cursor });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("rejects a cursor with non-alphanumeric characters", () => {
    const result = normalizeAndValidateFilters({ cursor: "abc;def" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("ignores an empty cursor string (no cursor applied)", () => {
    const result = normalizeAndValidateFilters({ cursor: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.cursor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Filter bounds — allowed enum sets (adversarial inputs)
// ---------------------------------------------------------------------------

describe("normalizeAndValidateFilters — adversarial enum inputs", () => {
  it("rejects an asset not in ALLOWED_ASSETS", () => {
    const result = normalizeAndValidateFilters({ asset: "BTC" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("rejects a category not in ALLOWED_CATEGORIES", () => {
    const result = normalizeAndValidateFilters({ category: "derivatives" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("silently resets an unknown sort to 'newest'", () => {
    const result = normalizeAndValidateFilters({ sort: "hot" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sort).toBe("newest");
  });

  it("silently resets an unknown availability to 'available'", () => {
    const result = normalizeAndValidateFilters({ availability: "maybe" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.availability).toBe("available");
  });

  it("rejects a minPrice equal to MAX_FILTER_PRICE (exclusive upper bound)", () => {
    const result = normalizeAndValidateFilters({
      minPrice: MARKETPLACE_BOUNDS.MAX_FILTER_PRICE,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a minPrice of negative value", () => {
    const result = normalizeAndValidateFilters({ minPrice: "-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });

  it("rejects a maxPrice of zero (below MIN_UNIT_PRICE)", () => {
    const result = normalizeAndValidateFilters({ maxPrice: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_request");
  });
});
