# 🚀 Server-side Caching Layer with TTL & SWR

A robust, edge-friendly, in-memory caching utility designed for read-heavy server-side routes like the prices proxy and user positions reads. By implementing strict Time-to-Live (TTL) and Stale-While-Revalidate (SWR) semantics, it dramatically reduces system latency, upstream source load, and network costs while maintaining high responsiveness.

---

## 🛠️ Design & Key Semantics

### 1. Fresh Hit (Age < TTL)
When a requested item is fresh, the cache returns it immediately. No upstream request is made.

### 2. Stale-While-Revalidate (TTL <= Age < TTL + SWR)
When a requested item is stale but falls within the SWR revalidation window:
1. The cache **immediately returns the stale value** to ensure low-latency response times.
2. A **background asynchronous fetch** is triggered to retrieve the fresh value from the upstream source.
3. Once the upstream request succeeds, the cache is updated with the fresh value.

### 3. Revalidation Lock
To prevent parallel duplicate requests to the upstream source when a key enters the SWR window (known as a *revalidation storm* or *cache stampede*), the cache employs a **revalidation concurrency lock**. If a background revalidation is already in progress for a key, subsequent SWR requests for that key will use the existing lock and will not spawn additional upstream calls.

### 4. Edge-Friendly & Lightweight
Built using standard ES6 classes and features (`Map`, `Set`, `Promise`), this caching module has **no external dependencies** and **no Node.js-specific API calls** (like `fs`, `path`, or `process`). It runs perfectly in any Javascript runtime, including:
- Vercel Edge Runtime / Next.js Edge API routes
- Cloudflare Workers / Durable Objects
- Standard Node.js servers

---

## 📋 API Reference

```typescript
import { globalCache, InMemoryCache } from '@/lib/cache';
```

### `globalCache.getOrFetch<T>(key, fetcher, options)`
The primary, recommended high-level entrypoint for fetching data safely:
```typescript
const { value, status } = await globalCache.getOrFetch(
  'cache-key',
  () => fetchUpstreamData(),
  { ttl: 5000, swr: 10000 } // millisecond values
);
```
- **Parameters**:
  - `key` (`string`): The cache key.
  - `fetcher` (`() => Promise<T>`): Async callback that queries the source.
  - `options` (`{ ttl: number; swr: number }`): Time intervals in milliseconds.
- **Returns**: `{ value: T; status: 'HIT' | 'STALE' | 'MISS' }`

### `globalCache.get<T>(key)`
Retrieves a value if it exists and has not completely expired. Returns `null` if expired.

### `globalCache.set<T>(key, value, options)`
Manually stores a value in the cache with specific `ttl` and `swr` options.

### `globalCache.delete(key)`
Manually invalidates/removes a single key from the cache.

### `globalCache.clear()`
Purges all cache entries and resets the revalidation keys.

---

## 🔒 Security & Cache Key Safety

### ⚠️ Never Include Secrets in Cache Keys
To guarantee absolute data security and prevent multi-tenant cache leaks:
1. **Cache keys must be constructed from public request inputs only** (e.g., asset tickers like `XLM,USDC` or static system flags like `network=testnet`).
2. **Never** include `Authorization` tokens, session IDs, cookies, custom user IDs, or API keys in a cache key.

---

## 🔄 Cache-Control Headers & Invalidation

### Authenticated Request Cache Bypass
When a user-specific read occurs (e.g., `/api/positions` for a logged-in user), the cache must be bypassed to prevent displaying outdated funds or exposing financial data between accounts.

Our API endpoints handle this securely by checking:
- `Authorization` header
- Custom headers like `x-user-id`
- Session/token cookies (`session`, `token`)

If any authentication indicators are present, the endpoint:
1. **Bypasses the cache completely** (queries the upstream directly).
2. Sets **strict cache control headers** to prevent caching in downstream clients, browser tabs, or public CDN edges:
   ```http
   Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
   Pragma: no-cache
   Expires: 0
   X-Cache: BYPASS
   ```

### Public Cache-Control Headers
For public, anonymous reads, standard Next.js response headers are emitted matching our cache settings to let browser agents and CDN proxies respect our TTL and SWR windows:
```http
Cache-Control: public, max-age=<ttl_seconds>, stale-while-revalidate=<swr_seconds>
X-Cache: HIT | STALE | MISS
```
