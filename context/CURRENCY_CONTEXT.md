# CurrencyContext

The `CurrencyContext` provides a global user preference for currency display across monetary UI components.

## Usage

Wrap your application or component tree in `CurrencyProvider`:

```tsx
import { CurrencyProvider } from '@/context/CurrencyContext';

function App() {
  return (
    <CurrencyProvider>
      <Dashboard />
    </CurrencyProvider>
  );
}
```

Consume the context using the `useCurrencyPreference` hook:

```tsx
import { useCurrencyPreference } from '@/context/CurrencyContext';
import { formatCurrency } from '@/lib/utils/format';

function Balance() {
  const { currency, isLoading } = useCurrencyPreference();
  const value = 1234.56;

  if (isLoading) return <span>Loading...</span>;

  return <span>{formatCurrency(value, 2, currency)}</span>;
}
```

## Behavior

- Fetches from `/api/account/preferences` on mount.
- Defaults to `USD` if the preference is unset, missing, or fails to fetch.
