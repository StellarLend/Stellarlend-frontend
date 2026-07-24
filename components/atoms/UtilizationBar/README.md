# UtilizationBar

A compact sparkline-style bar indicating an asset's market supply/borrow utilization. 

## Features
- Fetches utilization dynamically from `/api/markets` using the provided `asset`.
- Degrades gracefully if the market data is missing, showing `N/A`.
- Clamps values between 0% and 100%.
- Color-safe design displaying the numeric percentage adjacent to the visual bar.

## Usage

```tsx
import { UtilizationBar } from '@/components/atoms/UtilizationBar/UtilizationBar';

// In a list or table row
<UtilizationBar asset="USDC" />
```
