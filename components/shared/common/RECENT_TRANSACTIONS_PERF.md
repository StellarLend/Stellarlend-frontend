# RecentTransactions Performance Optimisation

## Executive Summary
`components/shared/common/RecentTransactions.tsx` delegates rendering to the shared `Transactions` component. Previously, `Transactions` rendered all rows inline via `visibleTransactions.map(...)` producing anonymous `<tr>` and `<div>` elements. Whenever the feed updated or a new page loaded during infinite scroll, React created new virtual DOM elements and re-rendered all visible rows—including rows whose transaction data had not changed. On long histories, this caused noticeable UI jank and excessive render cycles.

This optimisation refactors row rendering into extracted, memoised components keyed by stable transaction IDs and guarantees stable callback identities across parent updates.

---

## Architectural Changes & Optimisation Strategy

### 1. Extracted Memoised Row Components (`TransactionRow.tsx`)
- **`TransactionRow` (Desktop)**: Renders the table row (`<tr>`). Wrapped in `React.memo`.
- **`TransactionMobileRow` (Mobile)**: Renders the mobile card (`<div>`). Wrapped in `React.memo`.
- **Stable Keying**: Rows are keyed by `txn.id` (`key={txn.id ?? actualIndex}`), ensuring React preserves component instances across re-renders and list additions.

### 2. Stable Callback Identities (Zero Identity Churn)
For `React.memo` to skip rendering unchanged rows, all props passed to `TransactionRow` and `TransactionMobileRow` must remain strictly equal (`===`) across parent renders. Previously, inline arrow functions and dependencies on `transactions.length` caused callbacks to recreate on every feed update. We eliminated identity churn via:
- **`transactionsRef` Isolation**: Stored the `transactions` state in a `useRef`. Callbacks like `focusRow` and `handleRowKeyDown` read array length from `transactionsRef.current.length` rather than depending on `transactions` or `transactions.length` directly.
- **Stable Action Callbacks**: `handleFocusRow`, `handleSelectTxn`, and `setRowRef` are wrapped in `useCallback` with empty dependency arrays (`[]`), making their memory references immutable.
- **Targeted Expansion Prop (`isExpanded`)**: Rather than passing the full `selectedTxn` object to every row (which would cause all rows to re-render when selection changes), we pass a single computed boolean `isExpanded={isDetailOpen && selectedTxn?.id === txn.id}`. When a user clicks "Details", only the single targeted row re-renders.

---

## Verification & Benchmark Results

Automated unit tests in `components/shared/common/RecentTransactions.memo.test.tsx` verify render counts across core scenarios:

| Scenario Flow | Unchanged Rows Render Count | Changed / New Rows Render Count | Result |
| :--- | :---: | :---: | :---: |
| **Initial Load** (Page 1) | — | `1` | ✅ Verified |
| **Appending Page 2** (Infinite Scroll) | `1` (Skips re-render) | `1` | ✅ Verified |
| **Updating Single Row** | `1` (Skips re-render) | `2` | ✅ Verified |
| **Opening Row Details** | `1` (Skips re-render) | `2` | ✅ Verified |
| **Parent Re-render** (Unrelated State) | `1` (Skips re-render) | — | ✅ Verified |

---

## Edge Cases & Regressions
- **Behavioral Parity**: Zero changes to visual layout, table headers, column contents, formatting, or asset icons.
- **Accessibility Parity**: Preserves all keyboard navigation (`ArrowUp`, `ArrowDown`, `Home`, `End`), row focus trapping, `tabIndex`, `aria-rowindex`, `aria-label`, and `aria-expanded` attributes. Existing 19 accessibility tests in `RecentTransactions.test.tsx` continue to pass without regression.
