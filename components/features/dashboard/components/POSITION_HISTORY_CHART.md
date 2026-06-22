# PositionHistoryChart

`PositionHistoryChart` renders historical position snapshots from `/api/positions/history` on the dashboard.

## Behavior

- Fetches `supplied`, `borrowed`, `effectiveSupplyApy`, and `effectiveBorrowApy` snapshots.
- Supports `1h`, `1d`, `7d`, and `30d` intervals.
- Sends `from` and `to` timestamps as milliseconds.
- Validates the API's 365-day maximum range before fetching.
- Shows loading, empty, validation, and fetch-error states inline.

## Accessibility

The SVG line chart is paired with an accessible data table. Screen-reader users can read the exact timestamp, supplied balance, borrowed balance, supply APY, and borrow APY for every returned snapshot.
