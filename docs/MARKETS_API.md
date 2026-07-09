# Markets API

`GET /api/markets` returns the current market snapshot used by lending screens.
Consumers can request all markets or pass a comma-separated `asset` query
parameter to narrow the response.

## Borrow APR consumers

`BorrowingForm` reads the selected borrow asset through `useMarketRates`, which
requests `/api/markets?asset=<SYMBOL>` and uses the returned `borrowApr` in the
projected health calculation. The static `INTEREST_RATES` map remains only as a
fallback while the request is loading, when the selected asset is missing, or
when the markets request fails.

The form displays a small rate status next to the borrow asset selector so users
can tell whether the APR is live or currently using fallback data.
