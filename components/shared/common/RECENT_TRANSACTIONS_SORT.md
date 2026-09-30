# Recent Transactions Sorting

The recent transactions feed now exposes sortable column headers for Amount, Date, and Status.

## Behavior

- A single active sort is maintained at a time.
- Clicking a header toggles between ascending and descending order.
- The active sort is reflected in the URL as `sort` and `order` query parameters so the view can be shared.
- Headers expose `aria-sort` and can be activated with keyboard input.
- The existing infinite feed continues to work because sorting is applied to the loaded transactions in the UI layer.

## Notes

- Sorts are applied in the browser for the recent transactions card so the feed remains responsive while paging through the infinite list.
- Equal values fall back to a deterministic tie-breaker using the transaction date/time and ID.
