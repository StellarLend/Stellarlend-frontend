# Cursor-Based Infinite Scroll for Transactions

This feature adds cursor-based infinite scroll pagination to the transactions list, allowing users to browse beyond the first page without manual paging.

## Architecture

The infinite scroll implementation is built on three layers:

1. **`hooks/useInfiniteTransactions.ts`** — React hook that consumes the cursor-based `/api/transactions` endpoint. It manages:
   - First-page load on mount
   - `loadMore()` to fetch the next cursor page
   - Duplicate fetch guard via `loadingRef`
   - Error handling with retry
   - `reset()` for filter changes

2. **`components/shared/common/Transaction.tsx`** — Extended with an `infiniteScroll` boolean prop. When enabled, the component delegates data fetching to `useInfiniteTransactions` and replaces the offset-based `Pagination` component with:
   - An `IntersectionObserver` sentinel that triggers `loadMore()` when scrolled near
   - A visible "Load more" button (non-JS / a11y fallback)
   - A live region (`aria-live="polite"`) that announces newly loaded items

3. **Surfaces** — Both `RecentTransactions` (dashboard) and the full transactions page (`/dashboard/transactions`) pass `infiniteScroll` to the shared `Transactions` component.

## Hook API

```ts
useInfiniteTransactions(options?: UseInfiniteTransactionsOptions): UseInfiniteTransactionsReturn
```

### Options

| Option   | Type     | Default | Description                  |
| -------- | -------- | ------- | ---------------------------- |
| `limit`  | `number` | `6`     | Items per page               |
| `search` | `string` | —       | Search query                 |
| `status` | `string` | —       | Filter by transaction status |
| `sortBy` | `string` | —       | Sort field (`date`, `amount`) |
| `sortDir` | `string` | —       | Sort direction (`asc`, `desc`) |

### Return value

| Field          | Type         | Description                              |
| -------------- | ------------ | ---------------------------------------- |
| `transactions` | `Transaction[]` | Accumulated transactions across pages |
| `isLoading`    | `boolean`    | Initial page is loading                  |
| `isLoadingMore`| `boolean`    | Next page is loading                     |
| `isError`      | `boolean`    | Fetch error occurred                     |
| `error`        | `Error|null` | The error object                         |
| `hasMore`      | `boolean`    | There are more pages to load             |
| `loadMore`     | `() => void` | Fetch the next page                      |
| `reset`        | `() => void` | Reset state and reload from first page   |

## Test Coverage

`hooks/useInfiniteTransactions.test.ts` covers:
- First page loads on mount
- `loadMore()` appends next page
- Duplicate fetch guard
- Error state on network failure
- Empty first page
- `reset()` clears accumulated state
- Stops at final cursor
