/**
 * Pure marketplace invariants: bounded filter normalisation, purchase request
 * validation, listing sellability, price stability and stale-data detection.
 *
 * Nothing here touches the network or storage; keeping these functions pure
 * makes them trivially unit-testable and lets the API routes, hooks and UI
 * share exactly the same guardrails (no drift between "valid on the wire" and
 * "valid in the UI").
 */

import {
  MARKETPLACE_BOUNDS,
  MARKETPLACE_MESSAGES,
  type MarketplaceFilters,
  type MarketplaceListing,
  type MarketplaceSort,
  type PurchaseContext,
  type PurchaseErrorCode,
} from "@/types/marketplace";

export type InvariantResult =
  | { ok: true }
  | { ok: false; code: PurchaseErrorCode; message: string };

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: PurchaseErrorCode; message: string };

export class InvariantError extends Error {
  readonly code: PurchaseErrorCode;

  constructor(code: PurchaseErrorCode) {
    super(MARKETPLACE_MESSAGES[code]);
    this.name = "InvariantError";
    this.code = code;
  }
}

/** Parse a decimal string into integer base-unit BigInt at the given scale. */
export function parseUnits(value: string, decimals: number): bigint {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvariantError("invalid_request");
  }
  const normalized = value.trim();
  const isNegative = normalized.startsWith("-");
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [intPart = "", fracPart = ""] = unsigned.split(".");
  if (unsigned.split(".").length > 2 || !/^\d+$/.test(intPart + fracPart)) {
    throw new InvariantError("invalid_request");
  }
  const padded =
    intPart +
    (fracPart + "0".repeat(Math.max(0, decimals - fracPart.length))).slice(0, decimals);
  const raw = BigInt(padded || "0");
  return isNegative ? -raw : raw;
}

/** Format integer base-unit BigInt back to a decimal string. */
export function formatUnits(value: bigint, decimals: number): string {
  const negative = value < BigInt(0);
  const abs = negative ? -value : value;
  const scaled = abs.toString().padStart(decimals + 1, "0");
  const int = scaled.slice(0, -decimals) || "0";
  const frac = scaled.slice(-decimals).replace(/0+$/, "");
  const out = frac ? `${int}.${frac}` : int;
  return negative ? `-${out}` : out;
}

/** Strict decimal parse that scales human-readable input into base units. */
function parseBoundedUnits(value: unknown, min: string, max: string): bigint {
  if (typeof value !== "string") throw new InvariantError("invalid_request");
  let parsed: bigint;
  try {
    parsed = parseUnits(value, MARKETPLACE_BOUNDS.PRICE_DECIMALS);
  } catch {
    throw new InvariantError("invalid_request");
  }
  const minBig = BigInt(min);
  const maxBig = BigInt(max);
  if (parsed < minBig || parsed > maxBig) throw new InvariantError("invalid_request");
  return parsed;
}

/**
 * Strict integer parse for the exact (already-scaled) listing `unitPrice`.
 * The catalog serves `listing.unitPrice` in base units, and a purchase posts
 * that exact value back, so it must not be re-scaled -- re-scaling here is
 * what caused a phantom `price_changed` for clients echoing the catalog value.
 */
function parseIntegerUnits(value: unknown, min: string, max: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new InvariantError("invalid_request");
  }
  let parsed: bigint;
  try {
    parsed = BigInt(value.trim());
  } catch {
    throw new InvariantError("invalid_request");
  }
  const minBig = BigInt(min);
  const maxBig = BigInt(max);
  if (parsed < minBig || parsed > maxBig) throw new InvariantError("invalid_request");
  return parsed;
}

interface RawFilters {
  minPrice?: string;
  maxPrice?: string;
  asset?: string;
  category?: string;
  availability?: string;
  sort?: string;
  cursor?: string;
  pageSize?: string;
}

/**
 * Validate and bound a raw filter object (typically from URL query params).
 * Unknown keys are ignored; invalid values fail fast with a typed code.
 */
export function normalizeAndValidateFilters(
  raw: RawFilters,
): ValidationResult<MarketplaceFilters> {
  const filters: MarketplaceFilters = {};

  // pageSize is clamped into the allowed range; non-numeric resets to default.
  if (raw.pageSize !== undefined) {
    const pageSize = Number(raw.pageSize);
    if (Number.isNaN(pageSize) || pageSize < 0 || pageSize > 1e9) {
      filters.pageSize = MARKETPLACE_BOUNDS.DEFAULT_PAGE_SIZE;
    } else {
      filters.pageSize = Math.min(
        MARKETPLACE_BOUNDS.MAX_PAGE_SIZE,
        Math.max(MARKETPLACE_BOUNDS.MIN_PAGE_SIZE, Math.floor(pageSize)),
      );
    }
  }

  if (raw.availability === "all") {
    filters.availability = "all";
  } else {
    filters.availability = "available";
  }

  if (raw.sort) {
    if ((MARKETPLACE_BOUNDS.ALLOWED_SORTS as readonly string[]).includes(raw.sort)) {
      filters.sort = raw.sort as MarketplaceSort;
    } else {
      filters.sort = "newest";
    }
  } else {
    filters.sort = "newest";
  }

  if (raw.asset) {
    if ((MARKETPLACE_BOUNDS.ALLOWED_ASSETS as readonly string[]).includes(raw.asset)) {
      filters.asset = raw.asset;
    } else {
      return {
        ok: false,
        code: "invalid_request",
        message: `Unsupported asset filter '${raw.asset}'.`,
      };
    }
  }

  if (raw.category) {
    if ((MARKETPLACE_BOUNDS.ALLOWED_CATEGORIES as readonly string[]).includes(raw.category)) {
      filters.category = raw.category;
    } else {
      return {
        ok: false,
        code: "invalid_request",
        message: `Unsupported category filter '${raw.category}'.`,
      };
    }
  }

  let minBig: bigint | undefined;
  if (raw.minPrice !== undefined && raw.minPrice !== "") {
    try {
      minBig = parseBoundedUnits(
        raw.minPrice,
        MARKETPLACE_BOUNDS.MIN_UNIT_PRICE,
        MARKETPLACE_BOUNDS.MAX_FILTER_PRICE,
      );
    } catch {
      return { ok: false, code: "invalid_request", message: "minPrice is out of bounds." };
    }
  }

  let maxBig: bigint | undefined;
  if (raw.maxPrice !== undefined && raw.maxPrice !== "") {
    try {
      maxBig = parseBoundedUnits(
        raw.maxPrice,
        MARKETPLACE_BOUNDS.MIN_UNIT_PRICE,
        MARKETPLACE_BOUNDS.MAX_FILTER_PRICE,
      );
    } catch {
      return { ok: false, code: "invalid_request", message: "maxPrice is out of bounds." };
    }
  }

  if (minBig !== undefined && maxBig !== undefined && minBig > maxBig) {
    return {
      ok: false,
      code: "invalid_request",
      message: "minPrice cannot be greater than maxPrice.",
    };
  }

  if (raw.cursor !== undefined && raw.cursor !== "") {
    if (raw.cursor.length > MARKETPLACE_BOUNDS.CURSOR_MAX_LEN || !/^[A-Za-z0-9]+$/.test(raw.cursor)) {
      return { ok: false, code: "invalid_request", message: "Malformed pagination cursor." };
    }
    filters.cursor = raw.cursor;
  }

  if (minBig !== undefined) filters.minPrice = raw.minPrice;
  if (maxBig !== undefined) filters.maxPrice = raw.maxPrice;

  return { ok: true, value: filters };
}

/** A raw (unknown-typed) purchase request body. */
type RawPurchaseRequest = Record<string, unknown>;

export function validatePurchaseRequest(
  raw: RawPurchaseRequest,
): ValidationResult<PurchaseContext> {
  const listingId = raw.listingId;
  if (typeof listingId !== "string" || listingId.trim() === "") {
    return { ok: false, code: "invalid_request", message: "listingId is required." };
  }

  const quantity = raw.quantity;
  if (typeof quantity !== "string" || quantity.trim() === "") {
    return { ok: false, code: "invalid_request", message: "quantity is required." };
  }
  let quantityBig: bigint;
  try {
    quantityBig = BigInt(quantity.trim());
  } catch {
    return { ok: false, code: "invalid_request", message: "quantity is not a valid number." };
  }
  if (
    quantityBig < BigInt(MARKETPLACE_BOUNDS.MIN_QUANTITY) ||
    quantityBig > BigInt(MARKETPLACE_BOUNDS.MAX_QUANTITY)
  ) {
    return {
      ok: false,
      code: "below_min",
      message: `quantity must be within [${MARKETPLACE_BOUNDS.MIN_QUANTITY}, ${MARKETPLACE_BOUNDS.MAX_QUANTITY}].`,
    };
  }

  let unitPriceBig: bigint;
  try {
    unitPriceBig = parseIntegerUnits(
      raw.unitPrice,
      MARKETPLACE_BOUNDS.MIN_UNIT_PRICE,
      MARKETPLACE_BOUNDS.MAX_UNIT_PRICE,
    );
  } catch {
    return { ok: false, code: "invalid_request", message: "unitPrice is out of bounds." };
  }

  const idempotencyKey = raw.idempotencyKey;
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < MARKETPLACE_BOUNDS.IDEMPOTENCY_KEY_MIN_LEN ||
    idempotencyKey.length > MARKETPLACE_BOUNDS.IDEMPOTENCY_KEY_MAX_LEN
  ) {
    return {
      ok: false,
      code: "invalid_request",
      message: "idempotencyKey is required (8-96 characters).",
    };
  }

  const expectedVersion = raw.expectedVersion;
  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    return {
      ok: false,
      code: "invalid_request",
      message: "expectedVersion must be a non-negative integer.",
    };
  }

  const walletAddress = raw.walletAddress;
  if (
    typeof walletAddress !== "string" ||
    walletAddress.trim() === "" ||
    walletAddress.length > MARKETPLACE_BOUNDS.STELLAR_ADDRESS_MAX_LEN
  ) {
    return { ok: false, code: "invalid_request", message: "walletAddress is required." };
  }

  return {
    ok: true,
    value: {
      listingId: listingId.trim(),
      quantity: quantityBig.toString(),
      unitPrice: unitPriceBig.toString(),
      idempotencyKey,
      expectedVersion,
      walletAddress: walletAddress.trim(),
    },
  };
}

/** A listing the buyer can actually purchase (sellable + enough inventory). */
export function assertListingSellable(
  listing: MarketplaceListing | undefined,
  quantityBig: bigint,
): InvariantResult {
  if (!listing) {
    return { ok: false, code: "listing_unavailable", message: MARKETPLACE_MESSAGES.listing_unavailable };
  }
  if (listing.status !== "listed") {
    return {
      ok: false,
      code: "listing_unavailable",
      message: `Listing is '${listing.status}', not 'listed'.`,
    };
  }
  let availableBig: bigint;
  try {
    availableBig = BigInt(listing.quantityAvailable);
  } catch {
    return { ok: false, code: "invalid_request", message: "Listing inventory is malformed." };
  }
  if (availableBig < quantityBig) {
    return { ok: false, code: "no_inventory", message: MARKETPLACE_MESSAGES.no_inventory };
  }
  return { ok: true };
}

/** Price the client was shown must still match the listing (no silent slippage). */
export function assertPriceMatches(listing: MarketplaceListing, expectedUnitPriceBig: bigint): InvariantResult {
  let currentBig: bigint;
  try {
    currentBig = BigInt(listing.unitPrice);
  } catch {
    return { ok: false, code: "invalid_request", message: "Listing price is malformed." };
  }
  if (currentBig !== expectedUnitPriceBig) {
    return { ok: false, code: "price_changed", message: MARKETPLACE_MESSAGES.price_changed };
  }
  return { ok: true };
}

/** Optimistic-concurrency check: has the listing changed since we loaded it? */
export function isStale(listing: MarketplaceListing, expectedVersion: number): boolean {
  return listing.version !== expectedVersion;
}

/**
 * Deterministic fingerprint of the sellable facts of a listing. Two snapshots
 * with the same hash are interchangeable; a changed hash means the inventory
 * changed between loads. This is change detection, not a security primitive.
 */
export function computeInventoryHash(listing: MarketplaceListing): string {
  const input = `${listing.id}|${listing.version}|${listing.quantityAvailable}|${listing.unitPrice}|${listing.status}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(8, "0");
}