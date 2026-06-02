# Asset Registry - Quick Reference

## Files

- **[registry.json](./registry.json)** - Canonical asset metadata (XLM, USDC, BTC, ETH)
- **[registry.ts](./registry.ts)** - Module providing access to registry data
- **[registry.test.ts](./registry.test.ts)** - Unit tests for registry module
- **[index.ts](./index.ts)** - Module exports

## Quick Start

### Get all assets
```typescript
import { getAllAssets } from '@/lib/assets';
const assets = getAllAssets();
```

### Get specific asset
```typescript
import { getAssetMetadata } from '@/lib/assets';
const usdc = getAssetMetadata('USDC');
```

### Type-safe asset checking
```typescript
import { hasAsset } from '@/lib/assets';
if (hasAsset(userInput)) {
  // userInput is now typed as AssetSymbol
}
```

## API Endpoint

**GET /api/assets** - Returns asset metadata
- Query: `?symbols=XLM,USDC` (optional)
- Response: `{ assets: AssetMetadata[] }`
- Caching: 24h TTL / 48h SWR

## Key Features

✅ Centralized asset metadata
✅ Server-side validation at boot
✅ HTTP caching with SWR pattern
✅ Type-safe asset symbols
✅ 95%+ test coverage
✅ Zero hardcoded asset literals

## Documentation

See [../docs/ASSETS_REGISTRY.md](../docs/ASSETS_REGISTRY.md) for:
- Architecture overview
- Full API documentation
- Usage examples
- Caching behavior
- Testing guide
- Troubleshooting
- Maintenance guide

## Related

- Client endpoint: `/api/assets` (app/api/assets/route.ts)
- Validation schemas: `lib/validation/schemas/assets.ts`
- Asset types: `types/enums.ts` (AssetSymbol)
