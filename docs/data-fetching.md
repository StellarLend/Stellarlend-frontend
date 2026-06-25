# Client Data Fetching and Hook Conventions

This guide defines how client components fetch data from `app/api/*` routes and how contributors should add reusable hooks. Use it when wiring UI to a route, adding polling, or introducing a new route-backed state surface.

## Source of Truth

- API handlers live in `app/api/<resource>/route.ts` or `app/api/<resource>/<param>/route.ts`.
- Shared route-backed hooks live in `lib/<domain>/use<Resource>.ts`.
- Feature-only hooks may live under `components/features/<feature>/hooks/` until a second feature needs them.
- Route response types should live near the domain that owns the data, such as `lib/<domain>/types.ts` or `types/`.

The current example to follow is `lib/tx/useTxStatus.ts`, which maps to `app/api/tx/status/[hash]/route.ts` and keeps polling behavior outside presentation components.

## Hook Naming and Placement

Use `use<Resource>` names for hooks that own async state. The resource name should match the API route or user-facing domain.

| API route | Preferred hook | Location |
| --- | --- | --- |
| `/api/tx/status/[hash]` | `useTxStatus` | `lib/tx/useTxStatus.ts` |
| `/api/markets` | `useMarkets` | `lib/markets/useMarkets.ts` |
| `/api/positions` | `usePositions` | `lib/positions/usePositions.ts` |
| `/api/notifications` | `useNotifications` | `lib/notifications/useNotifications.ts` |

Keep hooks focused on data fetching, cancellation, retry, and state transitions. Components should render the resulting state instead of duplicating fetch logic inline.

## State Shape

New hooks should return a stable, explicit state object. Prefer a discriminated union when the route has terminal states, or a small resource state for ordinary fetches:

```ts
type ResourceState<T> =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "empty"; data: T; error: null }
  | { status: "error"; data: null; error: Error };
```

Use route-specific unions when they make the UI safer. For example, `useTxStatus` returns `processing`, `completed`, `failed`, and `rate_limited` states because the transaction status route has terminal and retry-limited outcomes.

## Loading, Empty, and Error Handling

Every route-backed component should handle these states deliberately:

- `idle`: no request has started because required input is missing.
- `loading`: render a skeleton, spinner, or disabled state that preserves layout.
- `empty`: render a useful empty state when the request succeeds but there are no items.
- `error`: render an inline recovery path and avoid crashing the component tree.
- terminal success/failure states: render based on the domain union, not by inspecting raw JSON in the component.

Do not leave components with a permanent blank area while a hook is loading or when data is empty.

## Error and Toast Policy

Hooks should expose errors to the caller. Components decide whether the error deserves an inline message, toast, or both.

Use toasts only for user-triggered actions, such as submitting a transaction, saving settings, or retrying a request. Do not toast passive background polling failures unless the user must act. Passive fetch errors should normally render inline status text or a retry button.

When a route returns a structured error object, preserve the route message for debugging but map it to user-facing copy at the component boundary.

## SSR Safety

Client hooks must be safe in the Next.js App Router:

- Add `"use client";` at the top of files that call React client hooks.
- Run browser-only APIs such as `window`, `document`, `localStorage`, and wallet providers inside `useEffect` or behind `typeof window !== "undefined"` guards.
- Use relative API URLs such as `/api/markets` from client components.
- Use an `AbortController` or equivalent cleanup for in-flight fetches when inputs change or the component unmounts.
- Avoid reading cookies or server-only environment variables from client hooks.

The `useTxStatus` hook demonstrates cleanup with `AbortController` and an unmount guard while polling `/api/tx/status/[hash]`.

## Mapping Hooks to API Routes

When adding a hook for an API route:

1. Read the route handler and document the response shape, cache behavior, and important status codes.
2. Place the hook in the matching domain under `lib/`.
3. Keep request parameters explicit in the hook signature.
4. Convert HTTP statuses into typed hook states before returning to UI components.
5. Test cancellation, loading, error, and terminal states when the hook contains meaningful behavior.

For cached public routes such as `/api/markets`, the hook can treat `200` responses as cache-agnostic data and leave `X-Cache` headers for diagnostics. For authenticated routes such as `/api/notifications`, handle `401` distinctly so callers can show a sign-in or session-expired state.

## Worked Example

The example below wires a component to `/api/markets` while covering loading, empty, and error states. It is intentionally small so a contributor can adapt it for a real hook.

```tsx
"use client";

import { useEffect, useState } from "react";

type Market = {
  asset: string;
  supplyApr: number;
  borrowApr: number;
};

type MarketsResponse = {
  markets: Market[];
  timestamp: string;
  source: string;
};

type MarketState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: MarketsResponse; error: null }
  | { status: "empty"; data: MarketsResponse; error: null }
  | { status: "error"; data: null; error: Error };

function useMarkets(asset?: string): MarketState {
  const [state, setState] = useState<MarketState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    const abort = new AbortController();
    const query = asset ? `?asset=${encodeURIComponent(asset)}` : "";

    async function loadMarkets() {
      setState({ status: "loading", data: null, error: null });

      try {
        const response = await fetch(`/api/markets${query}`, {
          signal: abort.signal,
        });

        if (!response.ok) {
          throw new Error(`Markets request failed with ${response.status}`);
        }

        const data = (await response.json()) as MarketsResponse;
        setState({
          status: data.markets.length === 0 ? "empty" : "success",
          data,
          error: null,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState({
          status: "error",
          data: null,
          error: error instanceof Error ? error : new Error("Unknown error"),
        });
      }
    }

    loadMarkets();

    return () => abort.abort();
  }, [asset]);

  return state;
}

export function MarketSummary({ asset }: { asset?: string }) {
  const state = useMarkets(asset);

  if (state.status === "loading") {
    return <p>Loading markets...</p>;
  }

  if (state.status === "error") {
    return <p role="alert">Market data could not be loaded.</p>;
  }

  if (state.status === "empty") {
    return <p>No markets are available for this filter.</p>;
  }

  return (
    <ul>
      {state.data.markets.map((market) => (
        <li key={market.asset}>
          {market.asset}: supply {market.supplyApr}% / borrow {market.borrowApr}%
        </li>
      ))}
    </ul>
  );
}
```

## Review Checklist

Before opening a PR for route-backed UI, verify:

- The hook maps to one API route or one cohesive domain.
- Loading, empty, error, and success states are all represented.
- Abort or cleanup behavior prevents state updates after unmount.
- Browser-only APIs are guarded for SSR safety.
- User-triggered failures can show toasts, while passive fetch failures render inline.
- README or feature docs link to any new route or hook guide when the pattern is new.
