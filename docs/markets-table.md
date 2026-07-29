# Markets Table Sort and Filter

The markets page renders the data returned by `GET /api/markets` without adding
extra API calls for sorting or filtering. `MarketsTable` keeps the fetched
`AssetMarket` rows in memory, applies the active sort order, and then filters the
sorted rows by the debounced asset query.

## Sort Keys

Desktop column headers are keyboard-operable buttons. The active header exposes
`aria-sort="ascending"` or `aria-sort="descending"`; inactive sortable headers
expose `aria-sort="none"`.

Supported sort keys:

- Asset symbol
- Supply APR
- Borrow APR
- Utilization
- Total supplied
- Total borrowed

Numeric ties fall back to the asset symbol so the rendered order stays stable.

## Asset Filter

The toolbar filter matches the asset symbol and the canonical asset name from
the shared asset registry. Matching is case-insensitive and runs client-side over
the already-loaded market rows.

The input is debounced before it changes the visible rows, while the clear action
resets immediately. When no rows match, the table and mobile cards are hidden and
an empty state offers a clear-filter action.

## Accessibility

The filter input has an explicit accessible name and the visible result count is
announced through a polite live region. Sorting remains available from table
headers, and the mobile cards reuse the same sorted and filtered row set.
