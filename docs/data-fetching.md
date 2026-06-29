# Client-Side Data-Fetching Conventions

This document outlines the standard patterns for fetching data on the client, managing asynchronous state (loading, error, empty), and integrating with the application's UI patterns (like toasts). 

Following these conventions ensures consistency across the codebase and prevents fragmented error-handling or loading states.

Real-time push flows (notifications, session-expiry warnings, etc.) intentionally bypass the request/response patterns below. See
[`docs/notifications.md`](./notifications.md) for the end-to-end SSE-backed
notification pipeline and its conventions.

## 1. Hook Location and Naming

- **Transaction and Core Domain Hooks**: Hooks that manage core domain operations, transactions, and on-chain interactions should live in `lib/tx/` or `lib/` (e.g., `lib/tx/useTxStatus.ts`).
- **UI and Feature Hooks**: Custom hooks that deal with UI state, data fetching for specific views, or specific feature logic should live in the `hooks/` directory (e.g., `hooks/usePositions.ts`).
- **Naming**: All custom hooks must be prefixed with `use` (e.g., `useMarketData`, `useUserPortfolio`).

## 2. Managing Loading, Error, and Empty States

Every data-fetching hook must expose a predictable set of properties to components so that the UI can reliably show spinners, errors, or empty states.

- **`isLoading` / `isPending`**: A boolean indicating if the data is currently being fetched for the first time.
- **`isError`**: A boolean indicating if the fetch operation failed.
- **`error`**: The actual error object or message (if `isError` is true).
- **`hasPartialFailure`**: (Optional) Use this boolean when a hook fetches multiple endpoints/contracts and only some fail.

*Example Return Type:*
```typescript
return {
  data: result.data,
  isLoading: result.isPending,
  isError: result.isError,
  error: result.error,
};
```

## 3. Toast-on-Error Policy

When a background data-fetch or a transaction fails, it is crucial to provide immediate, actionable feedback to the user without breaking the entire UI.

- Use the application's toast notification system to present error states.
- Do not blindly wrap entire pages in error boundaries for minor fetching errors; instead, gracefully degrade the UI (e.g., show a placeholder or empty state) and display a toast.
- For user-initiated actions (e.g., clicking "Refresh" or submitting a transaction), always use the toast lifecycle: `pending` -> `success` / `error`.

```tsx
import { toast } from "react-hot-toast"; // or your project's toast implementation

if (error) {
  toast.error("Data Fetch Failed: Unable to retrieve the latest market data.");
}
```

## 4. SSR-Safety (Window Guards)

Next.js will attempt to server-side render components by default. When your hooks rely on browser-specific APIs (like `window`, `localStorage`, or wallet connections), you must ensure they are SSR-safe.

- **`"use client"` Directive**: Any file defining a hook that uses React state (`useState`, `useEffect`), context, or browser APIs must include `"use client";` at the very top.
- **Window Checks**: If a utility function or hook executes immediately (outside of a `useEffect`), wrap browser API calls in a check:
  ```javascript
  if (typeof window !== "undefined") {
    // safe to use window or localStorage
  }
  ```

## 5. Wiring Components to `app/api/*` Routes (Worked Example)

Here is a full example of a custom hook fetching from an API route and wiring it to a React component.

### The Hook (`hooks/useMarketData.ts`)

```typescript
"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export interface MarketData {
  id: string;
  asset: string;
  supplyApy: number;
  borrowApy: number;
}

export function useMarketData(assetId: string) {
  const [data, setData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function fetchMarket() {
      try {
        const response = await fetch(`/api/markets/${assetId}`);
        if (!response.ok) throw new Error("Failed to fetch market data");
        
        const result = await response.json();
        if (isMounted) {
          setData(result);
          setIsError(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsError(true);
          setError(err as Error);
          toast.error(`Market Data Error: Could not load data for ${assetId}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (assetId) {
      fetchMarket();
    }

    return () => {
      isMounted = false;
    };
  }, [assetId]);

  return { data, isLoading, isError, error };
}
```

### The Component (`app/markets/[id]/page.tsx`)

```tsx
"use client";

import { useMarketData } from "@/hooks/useMarketData";

export default function MarketDetails({ params }: { params: { id: string } }) {
  const { data, isLoading, isError } = useMarketData(params.id);

  if (isLoading) {
    return <div className="animate-pulse">Loading market data...</div>;
  }

  if (isError) {
    // The toast already notified the user, gracefully show a fallback UI here
    return <div className="text-red-500">Unable to display market data at this time.</div>;
  }

  if (!data) {
    return <div>No market data found.</div>;
  }

  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-xl font-bold">{data.asset} Market</h2>
      <p>Supply APY: {data.supplyApy}%</p>
      <p>Borrow APY: {data.borrowApy}%</p>
    </div>
  );
}
```
