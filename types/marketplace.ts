/**
 * Marketplace purchase and listing filter types.
 *
 * Defines the explicit purchase and listing state, data, authorization, and
 * failure invariants for the marketplace feature. This mirrors the pattern
 * established for `types/commitment.ts`: states are explicit, transitions are
 * declared up front, bounds are centralised, and error handling is typed.
 */

/**
 * Authoritative lifecycle of a listing, as reported by the backend.
 */
export type ListingStatus = "listed" | "paused" | "sold_out" | "cancelled";

/**
 * A listing is an offer to sell a quantity of an asset at a fixed unit price.
 *
 * Money and quantity are carried as decimal strings in base units (7 decimals,
 * the same scale Stellar uses) so the client can reason about them with BigInt
 * instead of floating point. `version` and `inventoryHash` are the
 * optimistic-concurrency / stale-data tokens the purchase flow relies on.
 */
export interface MarketplaceListing {
  id: string;
  owner: string;
  title: string;
  description?: string;
  asset: string;
  category: string;
  /** Price of a single unit of quantity, in base units (BigInt-parsable). */
  unitPrice: string;
  /** Remaining sellable quantity, in base units (BigInt-parsable, integer). */
  quantityAvailable: string;
  status: ListingStatus;
  /** Monotonic token bumped on every successful mutation (optimistic locking). */
  version: number;
  /** Fingerprint of the sellable facts; lets clients detect data has changed. */
  inventoryHash: string;
  createdAt: string;
  updatedAt: string;
  sellerName?: string;
}

export type MarketplaceSort = "price_asc" | "price_desc" | "newest";
export type MarketplaceAvailability = "available" | "all";

/**
 * User-facing filter model. Monetary fields are strings (BigInt-parsable);
 * pagination uses an opaque cursor and a bounded page size.
 */
export interface MarketplaceFilters {
  minPrice?: string;
  maxPrice?: string;
  asset?: string;
  category?: string;
  availability?: MarketplaceAvailability;
  sort?: MarketplaceSort;
  cursor?: string;
  pageSize?: number;
}

/**
 * Purchase lifecycle. `confirming` is the explicit recovery state entered when
 * a submission ends ambiguously (timeout / aborted / network drop). From there
 * the client never re-runs the on-chain action silently: it either learns the
 * authoritative outcome via `reconcile`, or requires the user to confirm a
 * re-submission through `confirmRetry`.
 */
export type PurchaseState =
  | "idle"
  | "validating"
  | "submitting"
  | "confirming"
  | "succeeded"
  | "failed"
  | "cancelled";

export type PurchaseEvent =
  | "VALIDATE"
  | "VALIDATION_OK"
  | "VALIDATION_FAIL"
  | "SUBMIT_OK"
  | "SUBMIT_FAIL"
  | "SUBMIT_AMBIGUOUS"
  | "RECONCILE_OK"
  | "RECONCILE_FAILED"
  | "RECONCILE_UNKNOWN"
  | "CONFIRM_RETRY"
  | "CANCEL"
  | "RESET";

/**
 * Typed failure codes the UI can act on without string matching.
 */
export type PurchaseErrorCode =
  | "invalid_request"
  | "below_min"
  | "no_inventory"
  | "inventory_changed"
  | "price_changed"
  | "listing_unavailable"
  | "rate_limited"
  | "unauthorized"
  | "network_error"
  | "timeout"
  | "ambiguous"
  | "unknown";

export interface PurchaseError {
  code: PurchaseErrorCode;
  message: string;
  /** Fresh listing included when relevant (e.g. inventory_changed). */
  staleListing?: MarketplaceListing;
}

/**
 * Everything the client needs to reproduce or reconcile a purchase intent.
 * It is kept around across retries/cancellations so user intent survives an
 * interrupted wallet operation without losing the on-chain action's identity.
 */
export interface PurchaseContext {
  listingId: string;
  quantity: string;
  unitPrice: string;
  idempotencyKey: string;
  /** Version captured at submit time; used for stale-response detection. */
  expectedVersion: number;
  walletAddress: string;
}

export interface PurchaseResult {
  purchaseId: string;
  transactionHash: string;
  listingVersion: number;
  quantityFilled: string;
  quantityRemaining: string;
}

/**
 * Network/on-chain authored outcome of a purchase, used by recovery.
 */
export interface PurchaseOutcome {
  known: boolean;
  status: "succeeded" | "failed";
  result?: PurchaseResult;
  error?: PurchaseError;
}

// ---------------------------------------------------------------------------
// Explicit bounds (bounded filters / inputs). Centralised and named so the
// invariants tests, API routes and UI can share a single source of truth.
// ---------------------------------------------------------------------------

export const MARKETPLACE_BOUNDS = {
  /** Sub-unit precision used for price arithmetic (Stellar 7-decimal scale). */
  PRICE_DECIMALS: 7,
  MIN_UNIT_PRICE: "1",
  // 10^20 in base units (string-exponent; BigInt literals need ES2020).
  MAX_UNIT_PRICE: "1" + "0".repeat(20),
  /** Largest user-supplied price filter we will accept (rejects overflow). */
  MAX_FILTER_PRICE: "1" + "0".repeat(24),
  MIN_PAGE_SIZE: 1,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_SIZE: 25,
  IDEMPOTENCY_KEY_MIN_LEN: 8,
  IDEMPOTENCY_KEY_MAX_LEN: 96,
  STELLAR_ADDRESS_MAX_LEN: 64,
  MIN_QUANTITY: "1",
  MAX_QUANTITY: "1" + "0".repeat(9),
  CURSOR_MAX_LEN: 256,
  ALLOWED_ASSETS: ["USDC", "XLM"] as const,
  ALLOWED_CATEGORIES: ["collateral", "receivable", "claim"] as const,
  ALLOWED_SORTS: ["price_asc", "price_desc", "newest"] as const,
} as const;

/**
 * Truth table for purchase state transitions. A transition that is not listed
 * here is rejected by the state machine (`lib/marketplace/purchaseStateMachine`).
 */
export const PURCHASE_ALLOWED_TRANSITIONS: Record<PurchaseState, PurchaseEvent[]> = {
  idle: ["VALIDATE", "RESET"],
  validating: ["VALIDATION_OK", "VALIDATION_FAIL", "CANCEL"],
  submitting: ["SUBMIT_OK", "SUBMIT_FAIL", "SUBMIT_AMBIGUOUS", "CANCEL"],
  confirming: ["CONFIRM_RETRY", "RECONCILE_OK", "RECONCILE_FAILED", "RECONCILE_UNKNOWN", "CANCEL"],
  succeeded: ["RESET"],
  failed: ["VALIDATE", "RESET"],
  cancelled: ["RESET"],
};

export const MARKETPLACE_MESSAGES: Record<PurchaseErrorCode, string> = {
  invalid_request: "The purchase request failed client-side validation.",
  below_min: "Requested quantity is below the minimum allowed.",
  no_inventory: "There is not enough inventory available for this purchase.",
  inventory_changed: "The listing changed since it was loaded. Review it before continuing.",
  price_changed: "The listing price changed since it was loaded.",
  listing_unavailable: "This listing is no longer on sale.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  unauthorized: "This wallet is not authorised to complete this purchase.",
  network_error: "We couldn't reach the marketplace. Your purchase was not confirmed.",
  timeout: "The purchase request timed out before it was confirmed.",
  ambiguous: "We couldn't confirm whether the purchase went through.",
  unknown: "Something unexpected happened. No changes were applied.",
};