# NotificationBell Performance Optimization

## Overview

The `NotificationBell` component is rendered in the `TopNav`, which appears on every authenticated page. Each page navigation or state change in a sibling component triggers a re-render of `TopNav` and therefore of `NotificationBell`.

Without memoization, every re-render would recompute the derived display values (`displayCount`, `showBadge`, `ariaLabel`), even when `unreadCount` has not changed.

## Optimizations Applied

### 1. `useMemo` for derived values

| Derivation           | Memoized | Dependencies |
|----------------------|----------|--------------|
| `displayCount`       | Yes      | `unreadCount` |
| `showBadge`          | Yes      | `unreadCount` |
| `ariaLabel`          | Yes      | `showBadge`, `unreadCount` |

`useMemo` ensures these values are only recomputed when their dependencies actually change, avoiding unnecessary string concatenations and comparisons on every render.

### 2. Stable references

- `ariaLabel` is passed to `IconButton` as a prop. By memoizing it, the prop reference remains stable when `unreadCount` does not change, avoiding unnecessary work in the child component.
- No callbacks are currently passed to child rows, so `useCallback` is not yet required. The component is structured to easily add `useCallback`-wrapped handlers when a notification dropdown or panel is introduced.

## Test Coverage

`NotificationBell.memo.test.tsx` covers:

- **Unchanged inputs** – re-rendering with the same `unreadCount` produces identical DOM output (memoization prevents unnecessary recomputation).
- **New notification arrival** – increasing `unreadCount` correctly updates the badge.
- **Mark-as-read updates** – decreasing `unreadCount` correctly updates the badge.
- **Zero → non-zero → zero** – round-trip transition produces correct output at each step.
- **99+ cap stability** – values above the threshold maintain the capped display across re-renders.

## Future Work

When a notification dropdown/panel is added to this component:

- Wrap any `onClick` or `onKeyDown` handlers in `useCallback` to maintain stable references.
- Memoize any grouped/sorted notification arrays derived from the stream data using `useMemo`.
- Consider using `React.memo` on the dropdown sub-components to prevent re-renders of the notification list when only the bell icon changes.
