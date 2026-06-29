# SearchBar Live Results Dropdown

## Overview

The `SearchBar` component now supports a **live results dropdown** that displays matching positions and transactions as the user types. This turns the SearchBar into a fully accessible combobox with keyboard navigation, debounced queries, and proper focus management.

## Usage

### Basic Setup

```tsx
import { useState } from 'react';
import SearchBar from '@/components/molecules/SearchBar';
import { useSearchResults } from '@/lib/search';

function SearchPage() {
  const { results, search } = useSearchResults(300, 5);
  const [value, setValue] = useState('');

  return (
    <SearchBar
      placeholder="Search for token, asset, wallet address"
      initialValue={value}
      results={results}
      onSearch={(query) => {
        setValue(query);
        search(query);
      }}
      onResultSelect={(result) => {
        console.log('Selected:', result);
      }}
    />
  );
}
```

### With Navigation

```tsx
import { useRouter } from 'next/navigation';
import SearchBar from '@/components/molecules/SearchBar';
import { useSearchResults } from '@/lib/search';

function SearchPage() {
  const router = useRouter();
  const { results, search } = useSearchResults();

  return (
    <SearchBar
      placeholder="Search for token, asset, wallet address"
      onSearch={(query) => search(query)}
      results={results}
      onResultSelect={(result) => {
        if (result.type === 'transaction') {
          router.push(`/dashboard/transactions/${result.transaction.id}`);
        } else {
          router.push(`/dashboard/positions/${result.asset}`);
        }
      }}
    />
  );
}
```

### Without Live Results (Original Behavior)

Omitting the `results` prop renders the SearchBar as a plain input with no dropdown:

```tsx
<SearchBar
  placeholder="Search..."
  onSearch={handleSearch}
  onClear={handleClear}
/>
```

## Props (New)

| Prop | Type | Default | Description |
|---|---|---|---|
| `results` | `SearchResultsData \| undefined` | `undefined` | Search results data. When provided, enables combobox ARIA and the results dropdown. |
| `onResultSelect` | `(result: SearchResult) => void` | — | Called when a user clicks or presses Enter on a result. |
| `onNavigate` | `(path: string) => void` | — | Called with the detail page path when a result is activated. |
| `resultsListId` | `string \| undefined` | Auto-generated | Override the `id` used for `aria-controls` linkage. |

## Keyboard Navigation

| Key | Action |
|---|---|
| `ArrowDown` | Move focus from input to first result; move to next result |
| `ArrowUp` | Move to previous result (wraps to last) |
| `Enter` | Select the currently highlighted result |
| `Escape` | Close the dropdown, focus stays on input |
| `/` | Focus the search input (when not already focused) |

## States

The dropdown renders four states based on `SearchResultsData.state`:

| State | Display |
|---|---|
| `idle` | Dropdown hidden |
| `loading` | Spinner with "Searching transactions and positions..." |
| `success` | Grouped result list (transactions + positions) or empty state |
| `error` | Error message with icon |

## ARIA Attributes

When `results` is provided, the input becomes a combobox:

- `role="combobox"` — Identifies the input as a combobox
- `aria-expanded` — Toggles between `true`/`false` based on dropdown visibility
- `aria-controls` — Points to the results listbox `id`
- `aria-haspopup="listbox"` — Indicates the popup type
- `aria-autocomplete="list"` — Signals list-based autocomplete

The dropdown uses `role="listbox"` with `role="option"` items carrying `aria-selected`, `aria-posinset`, and `aria-setsize`.

## Files Changed

| File | Change |
|---|---|
| `components/molecules/SearchBar/SearchBar.tsx` | Extended with live results props, combobox ARIA, dropdown rendering, keyboard nav, outside click handling |
| `components/features/dashboard/components/SearchResults.tsx` | Added optional `id` prop for ARIA linkage |
| `hooks/useDebouncedValue.ts` | New generic debounced-value hook |
| `hooks/__tests__/useDebouncedValue.test.ts` | Tests for `useDebouncedValue` |
| `components/molecules/SearchBar/SearchBar.results.test.tsx` | Tests for live results functionality |

## Dependencies

- `@/lib/search/types` — `SearchResultsData`, `SearchResult` types
- `@/components/features/dashboard/components/SearchResults` — Results dropdown component
- `@/lib/search/useSearchResults` — Hook for debounced search queries with `AbortController`
