# Transaction Filters

The `TransactionFilters` component provides an accessible, URL-driven filtering interface for the dashboard's Transactions page.

## Key Features
- **URL Synchronization**: All filter states (Asset, Type, Status, Date Range, Search) are directly serialized into the browser's URL query string. This enables users to bookmark, share, and refresh specific views of their transaction history without losing context.
- **Server-Side Integration**: The `/api/transactions` endpoint parses these query parameters (via `parseTransactionFilter` from `lib/transactions/filters.ts`) to drive database-level filtering.
- **Responsive Layout**: Designed to stack elegantly on mobile while utilizing a horizontal flex layout on desktop.
- **Accessibility**: Native `select` elements are used alongside proper labels to ensure screen-reader compatibility. The component also features an `aria-live="polite"` region to announce the live count of loaded transactions.

## Architecture

1. **`TransactionFilters.tsx`**: Renders the UI and uses Next.js `useSearchParams`, `usePathname`, and `useRouter` to push state changes to the URL query string.
2. **`Transaction.tsx` (Shared Component)**: Configured to read state directly from the URL when instantiated with the `hideToolbar` prop. When `hideToolbar` is true, the component bypasses its internal filter UI and listens to the `searchParams` hook.
3. **`page.tsx`**: Mounts both the filters and the table. It acts as an intermediary, receiving the total count of loaded items from the table component (via the `onDataLoad` callback prop) and passing it into the filters component to update the live region.

## Example Usage

To mount the filters on a page containing the `Transactions` component:

```tsx
import React, { useState } from "react";
import TransactionFilters from "@/components/features/dashboard/components/TransactionFilters";
import { Transactions } from "@/components/shared/common/Transaction";

export default function MyTransactionsPage() {
  const [totalCount, setTotalCount] = useState(0);

  return (
    <div>
      {/* Renders the filter bar and announces the total count */}
      <TransactionFilters totalCount={totalCount} />

      {/* Renders the table, hiding its internal toolbar, and reporting the count via onDataLoad */}
      <Transactions hideToolbar={true} onDataLoad={setTotalCount} />
    </div>
  );
}
```

## Adding a New Filter
To add a new filter:
1. Ensure the backend API route supports it.
2. Add it to `TransactionFilters` in `lib/transactions/types.ts`.
3. Add UI controls in `TransactionFilters.tsx` and sync it via `useSearchParams()`.
4. Extract the param in `Transactions.tsx` and pass it to the `fetchTransactions` payload.
