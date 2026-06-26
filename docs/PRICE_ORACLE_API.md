# Price Oracle API Documentation

## Overview

The Price Oracle API is a server-side proxy that provides cached asset prices for the Stellarlend lending platform. It securely fetches prices for XLM, USDC, BTC, and ETH without exposing upstream API keys to the client.

## Architecture

### Key Features

- **Server-Side Caching**: Reduces upstream API calls with TTL and Stale-While-Revalidate strategy
- **Security**: API keys kept server-side only, never exposed to client
- **Input Validation**: Validates asset queries against the canonical supported asset list
- **Cache Headers**: Proper HTTP cache headers for CDN/browser caching
- **Error Resilience**: Graceful degradation with stale cache fallback

### Caching Strategy

- **TTL (Time-To-Live)**: 5 seconds - How long cache is considered fresh
- **SWR (Stale-While-Revalidate)**: 10 seconds - How long stale data is acceptable
- **Background Revalidation**: Automatically refreshes stale entries in the background

## API Endpoints

### GET /api/prices

Fetch cached asset prices with optional filtering.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assets` | string | No | Comma-separated list of assets (XLM, USDC, BTC, ETH). If omitted, all supported assets are returned. |

#### Examples

**Get all supported assets:**
```bash
GET /api/prices
```

**Get specific assets:**
```bash
GET /api/prices?assets=XLM,USDC
```

**Get single asset:**
```bash
GET /api/prices?assets=BTC
```

#### Response (Success - 200 OK)

```json
{
  "prices": {
    "XLM": 0.1245,
    "USDC": 1.0,
    "BTC": 67340.5,
    "ETH": 3480.2
  },
  "timestamp": "2024-05-27T12:34:56.789Z",
  "source": "Stellar Price Oracle Proxy",
  "cached": true,
  "cacheAge": 2500
}
```

#### Response (Error - 400 Bad Request)

```json
{
  "error": "Invalid assets query: Unsupported asset: INVALID. Supported assets: XLM, USDC, BTC, ETH",
  "code": "INVALID_ASSETS_QUERY",
  "timestamp": "2024-05-27T12:34:56.789Z"
}
```

#### Response (Error - 500 Internal Server Error)

```json
{
  "error": "Failed to fetch prices",
  "code": "PRICE_FETCH_ERROR",
  "timestamp": "2024-05-27T12:34:56.789Z"
}
```

## Implementation Details

### Supported Assets

The canonical list of supported assets is defined in [lib/prices/constants.ts](../lib/prices/constants.ts):

```typescript
export const SUPPORTED_ASSETS = ['XLM', 'USDC', 'BTC', 'ETH'] as const;
```

### Input Validation

The API validates all inputs:

- **Asset Name Validation**: Only accepts assets from the supported list
- **Duplicate Detection**: Rejects duplicate asset requests
- **Query Size Limits**: Maximum 10 assets per query to prevent abuse
- **Normalization**: Handles case-insensitive input and whitespace

### Security Features

1. **API Key Isolation**: Upstream API keys stored in server environment variables only
2. **Cache Bypass for Authenticated Requests**: Requests with authentication headers bypass cache
3. **Response Validation**: Ensures no API keys accidentally included in responses
4. **Proper Cache Headers**: Prevents unintended client/CDN caching of authenticated requests

### Cache Headers

**Public Requests (Cached):**
```
Cache-Control: public, max-age=5, stale-while-revalidate=10
X-Cache: HIT|STALE|MISS
Vary: Accept-Encoding
```

**Authenticated Requests (Not Cached):**
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
X-Cache: BYPASS
```

## Environment Variables

### Required (Server-Side Only)

Create a `.env.local` file with the following:

```env
# Price Oracle Configuration
PRICE_ORACLE_API_KEY=your-oracle-secret-api-key
```

**Note**: This variable is NOT exposed to the client (not prefixed with `NEXT_PUBLIC_`)

### Optional

```env
# For development/testing
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

## File Structure

```
lib/prices/
├── types.ts         # TypeScript interfaces and types
├── constants.ts     # Configuration constants and supported assets
├── validation.ts    # Input validation utilities
├── fetcher.ts       # Upstream price fetching logic
├── index.ts         # Public API exports
├── validation.test.ts  # Validation tests
└── fetcher.test.ts     # Fetcher tests

app/api/prices/
├── route.ts         # API endpoint handler
└── route.test.ts    # Route tests
```

## Usage Examples

### JavaScript/TypeScript Client

```typescript
// Get all supported assets
const response = await fetch('/api/prices');
const data = await response.json();
console.log(data.prices); // { XLM: 0.1245, USDC: 1, BTC: 67340.5, ETH: 3480.2 }

// Get specific assets
const response = await fetch('/api/prices?assets=XLM,USDC');
const data = await response.json();
console.log(data.prices); // { XLM: 0.1245, USDC: 1 }

// Handle errors
try {
  const response = await fetch('/api/prices?assets=INVALID');
  if (!response.ok) {
    const error = await response.json();
    console.error(error.error);
  }
} catch (err) {
  console.error('Request failed:', err);
}
```

### React Hook Example

```typescript
import { useEffect, useState } from 'react';
import type { PriceResponse } from '@/lib/prices';

export function usePrices(assets?: string[]) {
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const url = new URL('/api/prices', window.location.origin);
        if (assets?.length) {
          url.searchParams.set('assets', assets.join(','));
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch prices');

        const data: PriceResponse = await response.json();
        setPrices(data.prices);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, [assets]);

  return { prices, loading, error };
}
```

## Testing

### Run All Tests

```bash
pnpm test -- lib/prices app/api/prices
```

### Run Specific Test Suite

```bash
# Validation tests
pnpm test -- lib/prices/validation.test.ts

# Fetcher tests
pnpm test -- lib/prices/fetcher.test.ts

# Route tests
pnpm test -- app/api/prices/route.test.ts
```

### Coverage

```bash
pnpm test -- lib/prices app/api/prices --coverage
```

Target: **95%+ coverage**

## Performance Considerations

- **Cache TTL**: Balances freshness vs. reduction in upstream calls (5s optimal)
- **SWR Window**: Allows serving stale data while revalidating (10s optimal)
- **Concurrent Requests**: Background revalidation prevents thundering herd
- **Asset Limit**: Maximum 10 assets per request prevents abuse

## Security Considerations

1. **Never expose PRICE_ORACLE_API_KEY**: Keep this environment variable secret
2. **Input Validation**: All user inputs are validated before processing
3. **Cache Key Normalization**: Prevents cache poisoning via parameter reordering
4. **Response Validation**: Ensures no sensitive data leaked in responses
5. **Auth Bypass**: Authenticated requests always get fresh, non-cached data

## Troubleshooting

### "PRICE_ORACLE_API_KEY not configured"

**Solution**: Add `PRICE_ORACLE_API_KEY` to your `.env.local` file

### "Invalid assets query"

**Possible causes:**
- Asset name not in supported list (XLM, USDC, BTC, ETH)
- Duplicate asset names in query
- More than 10 assets requested

**Solution**: Check asset names and remove duplicates

### "Failed to fetch prices"

**Possible causes:**
- Upstream API is down
- Network connectivity issue
- API rate limit exceeded

**Solution**: Check upstream API status and network connectivity

## Integration with Lending Page

The prices API is used by the lending and borrowing components to display real-time asset prices:

```typescript
// In components/features/lending/components/InterestCalculator.tsx
const { prices, loading } = usePrices(['XLM', 'USDC', 'BTC', 'ETH']);
```

## Future Enhancements

- [ ] Support additional assets (SOL, DOGE, etc.)
- [ ] Implement Redis caching for distributed deployments
- [ ] Add price history/trends endpoint
- [ ] Implement circuit breaker for upstream failures
- [ ] Add metrics and monitoring
- [ ] Support multiple oracle sources with fallback

## References

- [Stellar Documentation](https://developers.stellar.org/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
