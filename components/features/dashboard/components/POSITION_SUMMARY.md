# PositionSummary Component

## Overview

The `PositionSummary` component is a dashboard hero section that displays a user's net lending position and account health status at a glance. It aggregates key metrics from the lending protocol into a single, easily understandable view.

## Features

- **Net Position Display**: Calculates and displays the difference between supplied and borrowed funds
- **Health Indicator**: Shows account health status with three levels:
  - **Healthy** (≥ 2.0x): Well-protected position with comfortable buffer
  - **At Risk** (1.0x - 1.99x): Adequate but requires attention
  - **Critical** (< 1.0x): High liquidation risk
- **Accessibility**: Full WCAG compliance with ARIA labels, semantic HTML, and non-color-dependent status indicators
- **Responsive Design**: Optimized for mobile, tablet, and desktop viewing
- **Loading & Error States**: Graceful handling of async data loading and error scenarios

## Component Props

```typescript
interface PositionData {
  suppliedFunds: string;        // e.g., "$5,000.00 XLM"
  borrowedAmount: string;       // e.g., "$1,500.00 XLM"
  healthFactor: number;         // e.g., 2.5
}

interface PositionSummaryProps {
  data: PositionData | null;    // Position data from API
  isLoading?: boolean;          // Loading state (default: false)
}
```

## Usage

### Basic Usage

```tsx
import PositionSummary from '@/components/features/dashboard/components/PositionSummary';

export function Dashboard() {
  const [positionData, setPositionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPositionData()
      .then(data => setPositionData(data))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <PositionSummary 
      data={positionData} 
      isLoading={isLoading}
    />
  );
}
```

## Data Structure

The component expects position data with the following format:

```typescript
{
  suppliedFunds: "$10,000.00 XLM",      // Formatted currency string
  borrowedAmount: "$3,500.00 XLM",      // Formatted currency string
  healthFactor: 2.85                    // Numeric health factor
}
```

## Health Factor Thresholds

| Health Factor | Status | Indicator | Description |
|---|---|---|---|
| ≥ 2.0x | Healthy | Green ✓ | Position well-protected |
| 1.0x - 1.99x | At Risk | Amber ⚠ | Needs attention |
| < 1.0x | Critical | Red ✗ | Liquidation risk |

## Accessibility Features

### ARIA Labels
- Region role with descriptive label for main container
- Article role for health indicator section
- Status role for loading state
- Alert role for error state

### Visual Indicators
- Health status includes both:
  - **Icon** (circle for healthy/at-risk, alert icon for critical)
  - **Text label** (always visible, not color-dependent)
  - **Health factor badge** with numeric display

### Screen Reader Support
- Comprehensive screen-reader-only summary
- All numeric values have accessible labels
- Semantic heading hierarchy (h3 for health status)
- Form labels for breakdown cards

## Styling & Typography

### Font Treatment
- **Net Position**: Large display (56px-96px) in monospace font for tabular alignment
- **Numeric Values**: Consistent monospace font (font-mono) for all currency displays
- **Labels**: Medium weight (500) for better readability

### Color Scheme
- **Background**: Dark green gradient (theme consistent)
- **Healthy**: Emerald colors with 950/900/700 shades
- **At Risk**: Amber colors with 950/900/700 shades
- **Critical**: Red colors with 950/900/700 shades

### Responsive Breakpoints
- Mobile: Single column, compact padding (p-8)
- Tablet+ (md): Two columns, expanded padding (p-12)
- Large text sizes: text-5xl (mobile) to text-6xl (md+)

## Testing

The component includes comprehensive test coverage (95%+) with tests for:
- Rendering with different health states
- Net position calculations
- Health factor threshold boundaries
- Accessibility compliance
- Edge cases and malformed data
- Loading and error states
- Visual consistency
- Responsive behavior

### Running Tests

```bash
# Run all tests
npm test

# Run PositionSummary tests specifically
npm test -- components/features/dashboard/components/PositionSummary.test.tsx

# Run with coverage
npm test -- --coverage
```

## Storybook Stories

View the component in Storybook with the following variants:

- **Healthy**: Account with strong health factor (2.85x)
- **AtRisk**: Account approaching danger zone (1.45x)
- **Critical**: Account with liquidation risk (0.62x)
- **Loading**: Data loading animation
- **Error**: Data load failure handling
- **HealthyBoundary**: Exactly 2.0x health factor
- **AtRiskBoundary**: Exactly 1.0x health factor
- **PositiveNetPosition**: Net position > 0
- **NegativeNetPosition**: Net position < 0
- **ZeroDebtPosition**: No borrowed funds
- **HighValuePosition**: Large amounts
- **SmallValuePosition**: Small amounts
- **VeryLowHealthFactor**: Near liquidation (0.001x)
- **VeryHighHealthFactor**: Heavily overcollateralized (99x)

### Running Storybook

```bash
npm run storybook
```

Then navigate to: http://localhost:6006/story/features-dashboard-positionsummary--healthy

## Data Flow

1. **Dashboard Page** fetches position data from `/api/positions`
2. **Position data** is passed to `PositionSummary` component
3. **Component calculates**:
   - Net position (supplied - borrowed)
   - Formatted currency values
   - Health status based on health factor
4. **Component renders** with appropriate styling and indicators

## Implementation Notes

### Currency Parsing
- The component parses formatted currency strings (e.g., "$5,000.00 XLM") 
- Extracts numeric values for calculations
- Handles edge cases like malformed strings gracefully

### Net Position Calculation
```typescript
netPosition = parseFloat(suppliedFunds) - parseFloat(borrowedAmount)
```

### Health Status Logic
```typescript
if (healthFactor >= 2.0) status = "healthy"
else if (healthFactor >= 1.0) status = "at-risk"
else status = "critical"
```

## Maintenance

### Common Issues

**Issue**: Component shows "Unable to load position summary"
- **Cause**: Data is null and isLoading is false
- **Fix**: Ensure API `/api/positions` is responding correctly

**Issue**: Health factor displays as "NaN"
- **Cause**: Malformed currency strings or invalid health factor
- **Fix**: Validate data from API endpoint

### Future Enhancements

- [ ] Add animation when health status changes
- [ ] Support for multiple currencies/assets
- [ ] Detailed position breakdown modal
- [ ] Historical health factor chart
- [ ] Notifications for status changes

## Related Components

- **MetricsCards**: Detailed breakdown of position metrics
- **DashboardLayout**: Main dashboard container
- **PageHeader**: Dashboard title and action buttons

## Resources

- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)
