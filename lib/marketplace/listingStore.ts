/**
 * Marketplace listing store.
 *
 * An in-memory stand-in for the database + on-chain ledger. It is where the
 * purchase invariants are *enforced*, not just validated:
 *
 *  - **Atomicity**  : mutations for the same listing are serialised through a
 *    per-listing promise queue so two concurrent purchases can never over-sell
 *    inventory.
 *  - **Idempotency** : any retry of a purchase that carries the same
 *    `idempotencyKey` returns the original outcome instead of running the
 *    on-chain action twice.
 *  - **Optimistic concurrency** : a purchase carries the `version` the client
 *    loaded; if the listing changed underneath it, the write is rejected with
 *    `inventory_changed` and the fresh listing is returned for recovery.
 *
 * Production would back this interface with a transactional database and a
 * Soroban contract; the functions here keep the same contract so the API
 * routes and recovery flows do not need to change.
 */

import {
  assertListingSellable,
  assertPriceMatches,
  computeInventoryHash,
  isStale,
  parseUnits,
} from "@/lib/marketplace/invariants";
import {
  MARKETPLACE_MESSAGES,
  type MarketplaceFilters,
  type MarketplaceListing,
  type PurchaseErrorCode,
} from "@/types/marketplace";

export interface StorePurchase {
  purchaseId: string;
  listingId: string;
  quantity: string;
  unitPrice: string;
  idempotencyKey: string;
  walletAddress: string;
  transactionHash: string;
  createdAt: string;
}

export type StoreListResult = {
  listings: MarketplaceListing[];
  nextCursor?: string;
  total: number;
};

export type PurchaseOutcome =
  | { status: "succeeded"; purchase: StorePurchase; freshListing: MarketplaceListing }
  | {
      status: "conflict";
      code: PurchaseErrorCode;
      message: string;
      freshListing?: MarketplaceListing;
    };

export type ReconcileResult = { known: false } | { known: true; outcome: PurchaseOutcome };

const PRICE_DECIMALS = 7;

function encodeCursor(index: number): string {
  return index.toString(36);
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const parsed = parseInt(cursor, 36);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

let listings = new Map<string, MarketplaceListing>();
let purchases = new Map<string, PurchaseOutcome>();
const listingQueues = new Map<string, Promise<void>>();

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function seedListing(
  id: string,
  partial: Omit<MarketplaceListing, "id" | "version" | "inventoryHash" | "createdAt" | "updatedAt">,
): MarketplaceListing {
  const listing: MarketplaceListing = {
    ...partial,
    id,
    version: 1,
    createdAt: daysFromNow(-7),
    updatedAt: daysFromNow(-7),
    inventoryHash: "",
  };
  listing.owner = partial.owner ?? "GSELLER00000000000000000000000000000000000000000000000001";
  listing.inventoryHash = computeInventoryHash(listing);
  return listing;
}

/** Rebuild the in-memory marketplace with a fresh, deterministic seed. */
export function resetMarketplaceStore(): void {
  listings = new Map<string, MarketplaceListing>();
  purchases = new Map<string, PurchaseOutcome>();
  listingQueues.clear();

  const seed: MarketplaceListing[] = [
    seedListing("lst_collateral_usdc", {
      title: "USDC collateral claim",
      description: "Fully backed collateral receivable.",
      owner: "GSELLER00000000000000000000000000000000000000000000000001",
      asset: "USDC",
      category: "collateral",
      unitPrice: parseUnits("1.25", PRICE_DECIMALS).toString(),
      quantityAvailable: "1000",
      status: "listed",
    }),
    seedListing("lst_receivable_xlm", {
      title: "XLM receivable note",
      description: "Fixed-term receivable.",
      owner: "GSELLER00000000000000000000000000000000000000000000000002",
      asset: "XLM",
      category: "receivable",
      unitPrice: parseUnits("0.05", PRICE_DECIMALS).toString(),
      quantityAvailable: "5000",
      status: "listed",
    }),
    seedListing("lst_claim_xlm", {
      title: "XLM liquidation claim",
      description: "Discounted claim.",
      owner: "GSELLER00000000000000000000000000000000000000000000000003",
      asset: "XLM",
      category: "claim",
      unitPrice: parseUnits("0.02", PRICE_DECIMALS).toString(),
      quantityAvailable: "2500",
      status: "listed",
    }),
    seedListing("lst_collateral_xlm", {
      title: "XLM collateral position",
      owner: "GSELLER00000000000000000000000000000000000000000000000004",
      asset: "XLM",
      category: "collateral",
      unitPrice: parseUnits("0.8", PRICE_DECIMALS).toString(),
      quantityAvailable: "300",
      status: "paused",
    }),
    seedListing("lst_receivable_usdc", {
      title: "USDC secured receivable",
      owner: "GSELLER00000000000000000000000000000000000000000000000005",
      asset: "USDC",
      category: "receivable",
      unitPrice: parseUnits("1.1", PRICE_DECIMALS).toString(),
      quantityAvailable: "800",
      status: "listed",
    }),
    seedListing("lst_claim_usdc", {
      title: "USDC short claim",
      owner: "GSELLER00000000000000000000000000000000000000000000000006",
      asset: "USDC",
      category: "claim",
      unitPrice: parseUnits("0.9", PRICE_DECIMALS).toString(),
      quantityAvailable: "0",
      status: "sold_out",
    }),
  ];

  for (const listing of seed) {
    listings.set(listing.id, listing);
  }
}

resetMarketplaceStore();

export function getListing(listingId: string): MarketplaceListing | undefined {
  return listings.get(listingId);
}

export function listListings(filters: MarketplaceFilters): StoreListResult {
  const minPrice = filters.minPrice
    ? parseUnits(filters.minPrice, PRICE_DECIMALS)
    : undefined;
  const maxPrice = filters.maxPrice
    ? parseUnits(filters.maxPrice, PRICE_DECIMALS)
    : undefined;

  const all = Array.from(listings.values()).filter((listing) => {
    if (filters.asset && listing.asset !== filters.asset) return false;
    if (filters.category && listing.category !== filters.category) return false;

    const price = BigInt(listing.unitPrice);
    if (minPrice !== undefined && price < minPrice) return false;
    if (maxPrice !== undefined && price > maxPrice) return false;

    if (filters.availability === "available" && listing.status !== "listed") return false;
    return true;
  });

  const sorted = [...all].sort((a, b) => {
    switch (filters.sort) {
      case "price_asc":
        return Number(BigInt(a.unitPrice) - BigInt(b.unitPrice));
      case "price_desc":
        return Number(BigInt(b.unitPrice) - BigInt(a.unitPrice));
      case "newest":
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  const pageSize = filters.pageSize ?? 25;
  const start = decodeCursor(filters.cursor);
  const end = start + pageSize;
  const page = sorted.slice(start, end);
  const nextCursor = end < sorted.length ? encodeCursor(end) : undefined;

  return { listings: page, nextCursor, total: sorted.length };
}

/** Serialise mutations for a single listing to keep decrements atomic. */
async function withListingLock<T>(listingId: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = listingQueues.get(listingId) ?? Promise.resolve();
  const run = previous.then(fn);
  // Store a settled placeholder so concurrent callers queue after us.
  listingQueues.set(
    listingId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/**
 * Execute a purchase atomically. Idempotent for the same `idempotencyKey`.
 */
export async function purchaseListing(input: {
  listingId: string;
  quantity: string;
  unitPrice: string;
  idempotencyKey: string;
  walletAddress: string;
  expectedVersion: number;
}): Promise<PurchaseOutcome> {
  const existing = purchases.get(input.idempotencyKey);
  if (existing) {
    return existing;
  }

  return withListingLock(input.listingId, () => {
    const listing = listings.get(input.listingId);
    const quantityBig = BigInt(input.quantity);

    const sellable = assertListingSellable(listing, quantityBig);
    if (!sellable.ok) {
      const outcome: PurchaseOutcome = {
        status: "conflict",
        code: sellable.code,
        message: sellable.message,
        freshListing: listing,
      };
      purchases.set(input.idempotencyKey, outcome);
      return outcome;
    }
    const safeListing = listing as MarketplaceListing;

    // Permission invariant: a seller may not purchase their own listing.
    if (safeListing.owner === input.walletAddress) {
      const outcome: PurchaseOutcome = {
        status: "conflict",
        code: "unauthorized",
        message: MARKETPLACE_MESSAGES.unauthorized,
        freshListing: safeListing,
      };
      purchases.set(input.idempotencyKey, outcome);
      return outcome;
    }

    if (isStale(safeListing, input.expectedVersion)) {
      const outcome: PurchaseOutcome = {
        status: "conflict",
        code: "inventory_changed",
        message: MARKETPLACE_MESSAGES.inventory_changed,
        freshListing: safeListing,
      };
      purchases.set(input.idempotencyKey, outcome);
      return outcome;
    }

    const priceOk = assertPriceMatches(safeListing, BigInt(input.unitPrice));
    if (!priceOk.ok) {
      const outcome: PurchaseOutcome = {
        status: "conflict",
        code: priceOk.code,
        message: priceOk.message,
        freshListing: safeListing,
      };
      purchases.set(input.idempotencyKey, outcome);
      return outcome;
    }

    // Atomically consume inventory and bump the concurrency token.
    const nextAvailable = (BigInt(safeListing.quantityAvailable) - quantityBig).toString();
    const nextStatus = nextAvailable === "0" ? "sold_out" : "listed";
    const nextVersion = safeListing.version + 1;
    const updated: MarketplaceListing = {
      ...safeListing,
      quantityAvailable: nextAvailable,
      status: nextStatus,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
    };
    updated.inventoryHash = computeInventoryHash(updated);
    listings.set(input.listingId, updated);

    const purchase: StorePurchase = {
      purchaseId: `p_${safeListing.id}_${nextVersion}`,
      listingId: safeListing.id,
      quantity: quantityBig.toString(),
      unitPrice: safeListing.unitPrice,
      idempotencyKey: input.idempotencyKey,
      walletAddress: input.walletAddress,
      transactionHash: `txn_${Math.random().toString(16).slice(2, 18)}`.padEnd(64, "0"),
      createdAt: new Date().toISOString(),
    };

    const outcome: PurchaseOutcome = { status: "succeeded", purchase, freshListing: updated };
    purchases.set(input.idempotencyKey, outcome);
    return outcome;
  });
}

/**
 * Authoritative outcome lookup for a previous submission. Returns `known:
 * false` when the server never saw it (e.g. it was rejected before hitting the
 * ledger). Never performs an action -- recovery only.
 */
export async function reconcilePurchase(idempotencyKey: string): Promise<ReconcileResult> {
  const outcome = purchases.get(idempotencyKey);
  if (!outcome) return { known: false };
  return { known: true, outcome };
}