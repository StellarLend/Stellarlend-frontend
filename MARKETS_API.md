# Markets API

`GET /api/markets` returns the lending-market rates consumed by the lending and borrowing forms.

## Query

| Parameter | Required | Description |
| --- | --- | --- |
| `asset` | No | Comma-separated asset symbols. Values are case-insensitive and normalized to the canonical symbols `XLM`, `USDC`, `BTC`, and `ETH`. Omit the parameter to request every supported market. |

Unknown symbols return `400` with a list of supported assets.

## Response

Successful responses use this shape:

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
  "timestamp": "2026-06-21T12:00:00.000Z",
  "source": "Soroban RPC stub (server relay)"
}
```

`supplyApr` and `borrowApr` are annual percentage rates. `utilization` is a decimal from `0` to `1`.

## Caching

Public requests are cached for `30` seconds with `60` seconds of stale-while-revalidate support:

```http
Cache-Control: public, max-age=30, stale-while-revalidate=60
```

Requests with an `Authorization` header, `session` or `token` cookie, or `x-user-id` header bypass shared caching and return:

```http
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
X-Cache: BYPASS
```
