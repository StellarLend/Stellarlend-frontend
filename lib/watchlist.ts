/**
 * Watchlist library — load/save/toggle starred markets, persisted in localStorage.
 *
 * Storage layout:
 *   Key:   stellarlend-watchlist:v1:<address|anon>
 *   Value: string[]  — array of validated market symbols
 *
 * Corrupt or unavailable storage falls back to an empty list without throwing.
 * The stored set is validated against the MARKETS symbols array on load so
 * stale or unknown symbols are silently dropped.
 */

import { MARKETS } from "./markets";

// ─── Storage helpers ──────────────────────────────────────────────────────────

/** Safe localStorage read; returns null when unavailable or on parse error. */
function safeRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Safe localStorage write; silently ignores quota / unavailability errors. */
function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable — watchlist will not persist this session
  }
}

// ─── Key ─────────────────────────────────────────────────────────────────────

/** Storage key namespaced by wallet address (falls back to "anon"). */
export function watchlistKey(address: string | null): string {
  return `stellarlend-watchlist:v1:${address ?? "anon"}`;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const KNOWN_SYMBOLS = new Set(MARKETS.map((m) => m.symbol));

/**
 * Validate a raw value from storage.
 * Accepts only an array of strings, and filters to known market symbols.
 * Returns an empty array for any corrupt or unexpected shape.
 */
function validateSymbols(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string => typeof item === "string" && KNOWN_SYMBOLS.has(item)
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load the watchlist from localStorage.
 * Falls back to [] on corrupt storage or unavailability.
 */
export function loadWatchlist(address: string | null): string[] {
  const key = watchlistKey(address);
  const raw = safeRead(key);
  return validateSymbols(raw);
}

/**
 * Persist the watchlist to localStorage.
 * Only known symbols are written; unknown symbols are silently dropped.
 */
export function saveWatchlist(address: string | null, symbols: string[]): void {
  const key = watchlistKey(address);
  const validated = validateSymbols(symbols);
  safeWrite(key, validated);
}

/**
 * Toggle a symbol's starred state.
 * Adds the symbol if not present; removes it if already present.
 * Returns the new watchlist (sorted for deterministic output, original order preserved for the rest).
 */
export function toggleWatchlist(current: string[], symbol: string): string[] {
  if (!KNOWN_SYMBOLS.has(symbol)) return current;
  if (current.includes(symbol)) {
    return current.filter((s) => s !== symbol);
  }
  return [...current, symbol];
}
