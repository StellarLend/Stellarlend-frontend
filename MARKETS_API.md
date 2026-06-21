# Markets API

`GET /api/markets` returns lending market rates for supported assets.

## Query

- `asset` optional comma-separated asset list, for example `?asset=XLM,USDC`.
- Asset symbols are case-insensitive and normalized to uppercase.
- Unknown symbols return `400` with an error message.

## Response

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
  "timestamp": "2026-06-21T00:00:00.000Z",
  "source": "Soroban RPC stub (server relay)"
}
```

Public responses are cached for 30 seconds with a 60-second stale-while-revalidate window. Requests with an `Authorization` header, `session` or `token` cookie, or `x-user-id` header bypass cache and return `X-Cache: BYPASS`.
