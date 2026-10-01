# Leverage Slider

The `LeverageSlider` component provides borrowers with a visual what-if projection of how changing their borrow amount affects their risk, without having to manually enter amounts and guess.

## Core Features
1. **Interactive Range Slider**: Allows the user to quickly drag from `0` to the max possible borrow amount for their collateral.
2. **Live Health Projection**: As the slider moves, it computes the projected health factor and collateral liquidation price in real time.
3. **Risk Scoring Color Track**: The track updates dynamically using `computeRiskScore` to shade the slider from green (healthy) to yellow (at-risk) to red (critical/undercollateralized).
4. **Memoization**: Uses `useMemo` heavily to ensure fast repaints during rapid slider dragging.

## Edge Cases Handled
- **Zero Collateral**: If the user has entered zero collateral, the slider is hidden.
- **Missing Prices**: Gracefully handles unavailable oracle prices by hiding the component.
- **Undercollateralised State**: The slider max bound allows reaching up to 100% LTV, which projects a `<1.0` health factor. This gives users visibility into where the liquidation threshold truly sits.
- **Rapid Dragging**: Computations are purely synchronous and lightweight, enabling smooth dragging with no visual jank.

## Usage
Simply drop `LeverageSlider` into forms that have a borrow/collateral amount:

```tsx
<LeverageSlider
  value={borrowAmount}
  onChange={setBorrowAmount}
  collateralAmount={collateralAmount}
  collateralAsset={collateralAsset}
  borrowAsset={borrowAsset}
  borrowApr={borrowApr}
  prices={pricesMap}
/>
```
