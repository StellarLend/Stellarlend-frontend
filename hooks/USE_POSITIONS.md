# usePositions Hook

The `usePositions` hook fetches and provides a user's open borrow positions, parsing both direct object format and array format from the API.

## Features

- **Automatic Fetching**: Fetches from `/api/positions` on mount.
- **Retry with Backoff**: Uses exponential backoff (capped at 5 attempts, max 10 seconds delay + jitter) to automatically recover from transient network errors.
- **Offline Awareness**: Detects network disconnections (using `navigator.onLine` and window events) and sets `isOffline`. Automatically refetches when the connection is restored.
- **Stale Data Indicator**: Exposes `isStale` flag when a refetch fails, allowing the UI to continue showing cached data with a warning banner.
- **Request Cancellation**: Aborts in-flight fetches when the component unmounts using `AbortController`.

## Usage

```tsx
import { usePositions } from '@/hooks/usePositions';

export function PositionsList() {
  const { positions, isLoading, error, isStale, isOffline, refetch } = usePositions();

  if (isLoading) return <div>Loading...</div>;
  if (isOffline) return <div>You are offline. Showing cached data.</div>;
  if (isStale) return <div>Data might be outdated. Retrying...</div>;

  return (
    <ul>
      {positions.map(p => (
        <li key={p.id}>{p.asset}: {p.amount}</li>
      ))}
    </ul>
  );
}
```
