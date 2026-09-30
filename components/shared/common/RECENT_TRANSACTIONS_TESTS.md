# RecentTransactions — RTL Test Plan

## Component under test

`components/shared/common/RecentTransactions.tsx`

Renders a card with a heading, "View All" button, and a `<Transactions>` feed
configured for infinite scroll.  `<Transactions>` internally renders a desktop
table and a matching mobile card list, so every transaction row appears **twice**
in the DOM — one per view.

---

## Test file

`components/shared/common/RecentTransactions.test.tsx`

---

## Mocks

| Dependency | Mock strategy | Reason |
|---|---|---|
| `next/image` | Replaced with plain `<img>` | jsdom has no Next.js image optimisation |
| `next/navigation` | `useRouter` returns `{ push: vi.fn() }`, `useSearchParams` returns `{ get: () => null }` | Prevents router context errors in jsdom |
| `@headlessui/react` | `Dialog` → `<div>`, `Transition`/`TransitionChild` → passthrough | The `Dialog` inside the toolbar throws when rendered without `open` prop in tests |
| `fetch` (global) | `vi.stubGlobal("fetch", mockFetch)` | Intercepts `/api/transactions` calls made by `useInfiniteTransactions` |

---

## Fixtures

A `makeTxn` factory creates `Transaction` objects with sensible defaults and
accepts per-test overrides.  Named fixtures:

| Name | Type | Amount | Asset | Status |
|---|---|---|---|---|
| `inflowTxn` | Deposit | +250 | XLM | Completed |
| `outflowTxn` | Withdrawal | −80 | USDC | Completed |
| `zeroTxn` | Loan Payment | 0 | ETH | Completed |
| `processTxn` | Lend Funds | +500 | BTC | Processing |
| `failedTxn` | Withdrawal | −40 | USDC | Failed |
| `negTxn` | Loan Payment | −999 | ETH | Completed |

---

## Test cases

### Structural

| # | Name | Assertion |
|---|---|---|
| 1 | renders the section heading | `getByText("Recent Transactions")` present |
| 2 | renders the View All button | `getByRole("button", { name: /view all/i })` present |

### Loading state

| # | Name | Assertion |
|---|---|---|
| 3 | shows loading skeleton initially | `getByLabelText("Loading transactions")` present before fetch resolves |

### Empty feed

| # | Name | Assertion |
|---|---|---|
| 4 | shows empty state when there are no transactions | `findByText("No transactions yet")` after empty API response |

### Row content

| # | Name | Assertion |
|---|---|---|
| 5 | renders transaction type | `findAllByText("Deposit")` ≥ 1 element |
| 6 | renders transaction ID | `getAllByText("#txn-in")` ≥ 1 element |
| 7 | renders asset symbol and icon | `getAllByText("XLM")` + `getAllByAltText("XLM")` each ≥ 1 |

### Signed-amount semantics

| # | Name | Assertion |
|---|---|---|
| 8 | inflow shows `+$amount` | `getAllByText("+$250")` ≥ 1 |
| 9 | outflow shows `-$amount` | `getAllByText("-$80")` ≥ 1 |
| 10 | large negative shows `-$999` | `getAllByText("-$999")` ≥ 1 |
| 11 | zero amount shows `-$0` (non-positive path) | `getAllByText("-$0")` ≥ 1 |

> The component treats `amount > 0` as inflow and anything else (including 0)
> as outflow, rendering `+$n` or `-$|n|` accordingly.

### Status rendering

| # | Name | Assertion |
|---|---|---|
| 12 | Completed status badge | `getAllByText("Completed")` ≥ 1 |
| 13 | Processing status badge | `getAllByText("Processing")` ≥ 1 |
| 14 | Failed status badge | `getAllByText("Failed")` ≥ 1 |

### Multiple rows

| # | Name | Assertion |
|---|---|---|
| 15 | renders multiple transaction rows | Deposit + Withdrawal + Lend Funds all present after 3-item API response |

### Asset variety

| # | Name | Assertion |
|---|---|---|
| 16 | BTC icon rendered | `getAllByAltText("BTC")` ≥ 1 |
| 17 | ETH icon rendered | `getAllByAltText("ETH")` ≥ 1 |

### Toolbar controls

| # | Name | Assertion |
|---|---|---|
| 18 | toolbar search toggle present | `getByText("Search")` in the document |
| 19 | toolbar filter toggle present | `getByText("Filter")` in the document |

---

## Key implementation notes

- **`findAllByText` over `findByText`** — Every text value appears in both the
  hidden desktop table and the visible mobile card list, so single-element
  queries throw.  All async content assertions use `findAllByText` /
  `getAllByText`.

- **`mockApi` helper** — Wraps a resolved `fetch` response so tests control the
  transaction list without touching network or `msw`.

- **`beforeEach` reset** — `vi.clearAllMocks()` and `mockApi([])` ensure tests
  are isolated.

---

## Running the tests

```bash
# all tests in this suite
pnpm vitest run --project accessibility RecentTransactions

# watch mode during development
pnpm vitest --project accessibility RecentTransactions
```

Expected output: **19 passed**.
