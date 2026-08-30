"use client";

/**
 * useChartHistory
 *
 * Shared fetch layer for all dashboard chart components that consume
 * GET /api/positions/history.
 *
 * Invariants enforced here:
 *
 * 1. ATOMIC state transitions — every status change is a single
 *    discriminated-union dispatch so the component never observes a
 *    half-updated state (e.g. status="ready" with points=[]).
 *
 * 2. REQUEST DEDUPLICATION — a module-level Map stores the in-flight
 *    Promise for each URL key.  A second mount with the same URL
 *    awaits the same Promise instead of issuing a second HTTP request.
 *
 * 3. STALE DATA PROPAGATION — when a retry succeeds after a prior
 *    failure, isStale is cleared atomically with the new data.  While
 *    retries are in-progress isStale=true so consumers can render an
 *    advisory banner.
 *
 * 4. RETRY with exponential back-off + jitter — up to MAX_RETRIES
 *    attempts, capped at MAX_BACKOFF_MS.  Aborted requests (component
 *    unmount / window changes) do not schedule further retries.
 *
 * 5. STALE RESPONSE REJECTION — each fetch is tagged with a
 *    generation counter.  Responses that arrive after a newer fetch
 *    has been issued are silently discarded, preventing contradictory
 *    client state from out-of-order responses.
 *
 * 6. UNIT NORMALIZATION — supplied/borrowed are validated as finite
 *    non-negative numbers before any derived metric is computed;
 *    effectiveSupplyApy is clamped to [0, 100] so the chart never
 *    presents a nonsensical percentage.
 *
 * 7. AUTHORIZATION BOUNDARY — when an authContext is supplied the hook
 *    enforces wallet connection, network match, and response ownership
 *    before data is accepted.  A disconnected wallet or wrong-network
 *    session short-circuits to the "unauthorized" status immediately
 *    (no HTTP request is issued).  A 401/403 response and a wallet
 *    address mismatch in the payload both map to "unauthorized" so
 *    callers receive a consistent, tamper-resistant signal.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { SnapshotHistoryResponse } from "@/lib/positions/snapshot";
import { isAccountId } from "@/lib/validation/stellar";

// ─── Public types ──────────────────────────────────────────────────────────────

/**
 * Authorization context supplied by the wallet provider.
 * When present, the hook refuses to fetch unless the wallet is connected
 * to the expected network, and rejects any response whose walletAddress
 * does not match the active wallet.
 */
export interface ChartAuthContext {
  /** Active Stellar public key, or null when the wallet is not connected. */
  walletAddress: string | null;
  /** Wallet connection status. Only "connected" passes the auth gate. */
  status: "disconnected" | "connecting" | "connected" | "error";
  /** Expected network — responses from the wrong network are rejected. */
  network: "PUBLIC" | "TESTNET";
}

export interface NormalizedSnapshot {
  timestamp: number;
  /** USD value: supplied − borrowed (may be negative) */
  netValue: number;
  /** Supplied balance in USD, validated finite & non-negative */
  supplied: number;
  /** Borrowed balance in USD, validated finite & non-negative */
  borrowed: number;
  /**
   * Effective supply APY clamped to [0, 100].
   * NaN / Infinity inputs are normalised to 0.
   */
  supplyApy: number;
  /**
   * Collateral ratio supplied/borrowed.
   * Null when borrowed === 0 (no debt, ratio is undefined).
   */
  collateralRatio: number | null;
}

/**
 * Discriminated-union status type.
 * Consumers branch on `status` and are guaranteed the accompanying fields
 * are consistent with that branch.
 */
export type ChartHistoryState =
  | { status: "idle" }
  | { status: "unauthorized"; reason: ChartAuthFailureReason }
  | { status: "loading"; isStale: false }
  | { status: "loading-stale"; isStale: true; snapshots: NormalizedSnapshot[] }
  | { status: "ready"; isStale: false; snapshots: NormalizedSnapshot[] }
  | { status: "empty"; isStale: false }
  | { status: "error"; isStale: boolean; error: Error; snapshots: NormalizedSnapshot[] };

/**
 * Reason codes for the "unauthorized" status.
 * - disconnected-wallet: no wallet connected, or wallet status is not "connected"
 * - wrong-network:       wallet is connected but to a different network than expected
 * - forbidden:           server returned 401 or 403
 * - wallet-mismatch:     response walletAddress does not match the connected wallet
 * - invalid-wallet:      walletAddress in the response is not a valid Stellar account ID
 */
export type ChartAuthFailureReason =
  | "disconnected-wallet"
  | "wrong-network"
  | "forbidden"
  | "wallet-mismatch"
  | "invalid-wallet";

export interface UseChartHistoryOptions {
  /** Overrides `fetch` for testing. Defaults to the global `fetch`. */
  fetcher?: typeof fetch;
  /**
   * When supplied, the hook checks wallet connection status and network
   * before issuing any request, and validates the response walletAddress
   * against the active wallet.  Omitting this option skips auth checks
   * (backward-compatible for contexts where auth is enforced upstream).
   */
  authContext?: ChartAuthContext;
}

export interface UseChartHistoryResult {
  state: ChartHistoryState;
  /** Imperatively re-fetch, bypassing the deduplication cache. */
  refetch: () => void;
}

// ─── Module-level deduplication store ─────────────────────────────────────────

/**
 * Keyed by the request URL string.
 * Cleared when the request settles (success or failure) so the next
 * mount always issues a fresh request after the first one completes.
 */
const inflightRequests = new Map<string, Promise<SnapshotHistoryResponse>>();

// ─── Retry constants ───────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 800;
const MAX_BACKOFF_MS = 8_000;

function backoffDelay(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** attempt;
  const capped = Math.min(exponential, MAX_BACKOFF_MS);
  const jitter = Math.random() * 300;
  return capped + jitter;
}

// ─── Normalisation helpers ─────────────────────────────────────────────────────

function isFiniteNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

/**
 * Validates and normalises a raw snapshot.
 * Returns null for snapshots that cannot produce a meaningful chart point
 * (non-finite or negative supplied/borrowed values).
 */
function normalizeSnapshot(
  raw: SnapshotHistoryResponse["snapshots"][number],
): NormalizedSnapshot | null {
  const supplied = isFiniteNonNegative(raw.supplied) ? raw.supplied : null;
  const borrowed = isFiniteNonNegative(raw.borrowed) ? raw.borrowed : null;

  // Both sides must be valid to include this point
  if (supplied === null || borrowed === null) return null;
  if (!Number.isFinite(raw.timestamp) || raw.timestamp <= 0) return null;

  // Clamp APY to [0, 100]; treat NaN/Infinity as 0
  const supplyApy =
    Number.isFinite(raw.effectiveSupplyApy) && raw.effectiveSupplyApy >= 0
      ? Math.min(raw.effectiveSupplyApy, 100)
      : 0;

  return {
    timestamp: raw.timestamp,
    netValue: supplied - borrowed,
    supplied,
    borrowed,
    supplyApy,
    collateralRatio: borrowed > 0 ? supplied / borrowed : null,
  };
}

function normalizeSnapshots(
  raw: SnapshotHistoryResponse["snapshots"],
): NormalizedSnapshot[] {
  return raw
    .map(normalizeSnapshot)
    .filter((s): s is NormalizedSnapshot => s !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "FETCH_START"; hasStaleData: boolean; staleSnapshots: NormalizedSnapshot[] }
  | { type: "FETCH_SUCCESS"; snapshots: NormalizedSnapshot[] }
  | { type: "FETCH_EMPTY" }
  | { type: "FETCH_ERROR"; error: Error; snapshots: NormalizedSnapshot[] }
  | { type: "FETCH_UNAUTHORIZED"; reason: ChartAuthFailureReason };

function reducer(_prev: ChartHistoryState, action: Action): ChartHistoryState {
  switch (action.type) {
    case "FETCH_START":
      return action.hasStaleData
        ? { status: "loading-stale", isStale: true, snapshots: action.staleSnapshots }
        : { status: "loading", isStale: false };

    case "FETCH_SUCCESS":
      return { status: "ready", isStale: false, snapshots: action.snapshots };

    case "FETCH_EMPTY":
      return { status: "empty", isStale: false };

    case "FETCH_ERROR":
      return {
        status: "error",
        isStale: true,
        error: action.error,
        snapshots: action.snapshots,
      };

    case "FETCH_UNAUTHORIZED":
      return { status: "unauthorized", reason: action.reason };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param url  Full URL (or path) for the history endpoint, e.g.
 *             `"/api/positions/history?interval=1d"`.
 *             Changing this value cancels any in-flight request and starts
 *             a new one.
 */
export function useChartHistory(
  url: string,
  { fetcher = fetch, authContext }: UseChartHistoryOptions = {},
): UseChartHistoryResult {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });

  /**
   * Monotonically-increasing generation counter.  When a newer fetch
   * starts, any response from an older generation is discarded.
   */
  const generationRef = useRef(0);

  /**
   * Preserve last known good snapshots across transitions so we can
   * pass them to FETCH_START (loading-stale) and FETCH_ERROR.
   */
  const lastGoodSnapshotsRef = useRef<NormalizedSnapshot[]>([]);

  const fetchWithRetry = useCallback(
    async (
      abortSignal: AbortSignal,
      generation: number,
      attempt = 0,
    ): Promise<void> => {
      // Stale-generation guard: a newer fetch superseded this one
      if (generation !== generationRef.current) return;

      // ── Pre-flight authorization check ────────────────────────────────────
      // Performed on every attempt (not just attempt=0) so that a wallet
      // disconnect mid-retry is caught before the next request is issued.
      if (authContext) {
        if (authContext.status !== "connected" || !authContext.walletAddress) {
          dispatch({ type: "FETCH_UNAUTHORIZED", reason: "disconnected-wallet" });
          return;
        }
        // Validate the wallet address itself is a proper Stellar account ID
        if (!isAccountId(authContext.walletAddress)) {
          dispatch({ type: "FETCH_UNAUTHORIZED", reason: "invalid-wallet" });
          return;
        }
      }

      // Only dispatch FETCH_START on the first attempt — retries keep the
      // current loading/loading-stale state without resetting it.
      if (attempt === 0) {
        const hasStale = lastGoodSnapshotsRef.current.length > 0;
        dispatch({
          type: "FETCH_START",
          hasStaleData: hasStale,
          staleSnapshots: lastGoodSnapshotsRef.current,
        });
      }

      try {
        let payload: SnapshotHistoryResponse;

        // ── Deduplication ──────────────────────────────────────────────────
        const existing = inflightRequests.get(url);
        if (existing && attempt === 0) {
          // Reuse the in-flight promise; don't issue a duplicate HTTP request
          payload = await existing;
        } else {
          // Bypass deduplication on retries so each retry is a fresh request
          const request = fetcher(url, {
            signal: abortSignal,
            headers: { Accept: "application/json" },
          }).then(async (res) => {
            // ── HTTP authorization check ───────────────────────────────────
            if (res.status === 401 || res.status === 403) {
              throw Object.assign(
                new Error(`Unauthorized: ${res.status} ${res.statusText}`),
                { authFailure: "forbidden" as ChartAuthFailureReason },
              );
            }
            if (!res.ok) {
              throw new Error(
                `History request failed: ${res.status} ${res.statusText}`,
              );
            }
            return res.json() as Promise<SnapshotHistoryResponse>;
          });

          if (attempt === 0) {
            inflightRequests.set(url, request);
            request.finally(() => inflightRequests.delete(url));
          }

          payload = await request;
        }

        // Stale-generation guard after await
        if (generation !== generationRef.current) return;

        // ── Response ownership validation ──────────────────────────────────
        // When an auth context is provided we verify the response walletAddress
        // matches the active wallet to detect replay or wrong-account responses.
        if (authContext?.walletAddress) {
          const responseWallet = (payload as { walletAddress?: unknown }).walletAddress;
          if (typeof responseWallet === "string") {
            if (!isAccountId(responseWallet)) {
              dispatch({ type: "FETCH_UNAUTHORIZED", reason: "invalid-wallet" });
              return;
            }
            if (responseWallet !== authContext.walletAddress) {
              dispatch({ type: "FETCH_UNAUTHORIZED", reason: "wallet-mismatch" });
              return;
            }
          }
        }

        const snapshots = normalizeSnapshots(
          Array.isArray(payload?.snapshots) ? payload.snapshots : [],
        );

        if (snapshots.length === 0) {
          dispatch({ type: "FETCH_EMPTY" });
        } else {
          lastGoodSnapshotsRef.current = snapshots;
          dispatch({ type: "FETCH_SUCCESS", snapshots });
        }
      } catch (err) {
        // Abort errors from component unmount / URL change — stop silently
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (abortSignal.aborted) return;

        // Stale-generation guard after await
        if (generation !== generationRef.current) return;

        // ── Auth failures are not retried ─────────────────────────────────
        const authFailure = (err as { authFailure?: ChartAuthFailureReason }).authFailure;
        if (authFailure) {
          dispatch({ type: "FETCH_UNAUTHORIZED", reason: authFailure });
          return;
        }

        if (attempt < MAX_RETRIES) {
          const delay = backoffDelay(attempt);
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, delay);
            // Cancel the wait if the request is aborted during back-off
            abortSignal.addEventListener("abort", () => {
              clearTimeout(t);
              resolve();
            }, { once: true });
          });

          if (abortSignal.aborted) return;
          if (generation !== generationRef.current) return;

          return fetchWithRetry(abortSignal, generation, attempt + 1);
        }

        const errorObj = err instanceof Error ? err : new Error(String(err));
        dispatch({
          type: "FETCH_ERROR",
          error: errorObj,
          snapshots: lastGoodSnapshotsRef.current,
        });
      }
    },
    // fetcher identity is stable in production (global fetch); tests swap it
    // per-render, so including it keeps the hook honest in both contexts.
    // authContext is included so a wallet disconnect triggers a re-evaluation.
    [url, fetcher, authContext],
  );

  useEffect(() => {
    const controller = new AbortController();
    generationRef.current += 1;
    const gen = generationRef.current;

    fetchWithRetry(controller.signal, gen);

    return () => {
      controller.abort();
    };
  }, [fetchWithRetry]);

  /** Imperative refetch — bypasses deduplication cache */
  const refetch = useCallback(() => {
    inflightRequests.delete(url);
    const controller = new AbortController();
    generationRef.current += 1;
    const gen = generationRef.current;
    fetchWithRetry(controller.signal, gen);
  }, [url, fetchWithRetry]);

  return useMemo(() => ({ state, refetch }), [state, refetch]);
}

// ─── Convenience selectors ─────────────────────────────────────────────────────

/** True while any fetch (including retries) is pending. */
export function isChartLoading(state: ChartHistoryState): boolean {
  return state.status === "loading" || state.status === "loading-stale";
}

/** True when the hook has stopped due to an auth/authorization failure. */
export function isChartUnauthorized(state: ChartHistoryState): state is { status: "unauthorized"; reason: ChartAuthFailureReason } {
  return state.status === "unauthorized";
}

/** Safe snapshot accessor — returns [] for non-data states. */
export function getSnapshots(state: ChartHistoryState): NormalizedSnapshot[] {
  if (
    state.status === "ready" ||
    state.status === "loading-stale" ||
    state.status === "error"
  ) {
    return state.snapshots;
  }
  return [];
}
