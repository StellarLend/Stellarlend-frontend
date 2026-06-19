# Markets API

`GET /api/markets` returns lending market data for the supported Stellarlend assets.

## Query Parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `asset` | No | Comma-separated asset symbols. Symbols are case-insensitive and must be one of `XLM`, `USDC`, `BTC`, or `ETH`. Omit the parameter to return every supported market. |

Examples:

```text
GET /api/markets
GET /api/markets?asset=XLM
GET /api/markets?asset=xlm,usdc
```

## Response

Successful responses use the `MarketsResponse` shape from `lib/markets/types.ts`.

```json
{
  "markets": [
    {
      "asset": "XLM",
      "supplyApr": 8.5,
      "borrowApr": 12,
      "utilization": 0.71,
      "totalSupply": 2500000,
      "totalBorrow": 1775000
    }
  ],
  "timestamp": "2026-06-20T00:00:00.000Z",
  "source": "Soroban RPC stub (server relay)"
}
```

`markets` is ordered from the requested asset list. When `asset` is omitted, the route returns the canonical order from `ASSET_SYMBOLS`.

## Caching

Unauthenticated requests use the shared server cache:

```text
Cache-Control: public, max-age=30, stale-while-revalidate=60
X-Cache: MISS | HIT | STALE
```

The cache key sorts requested assets so `?asset=XLM,USDC` and `?asset=USDC,XLM` share one cached value.

Requests with an `Authorization` header, `session` or `token` cookie, or `x-user-id` header bypass the public cache:

```text
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
X-Cache: BYPASS
```

## Errors

Unknown or malformed asset lists return `400` with the unsupported symbol and the supported symbol list:

```json
{
  "error": "Unknown asset(s): UNKNOWN. Supported: XLM, USDC, BTC, ETH"
}
```

Unexpected route or data-source failures return:

```json
{
  "error": "Failed to fetch market data"
}
```
