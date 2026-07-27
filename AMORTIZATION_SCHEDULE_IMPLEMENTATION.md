# Amortization Schedule Implementation

## Overview

This implementation adds an amortization schedule table to the InterestCalculator component for borrow repayments, addressing issue #496.

## Changes Made

### 1. Core Utility Function (`lib/lending/amortization.ts`)

- **`generateAmortizationSchedule()`**: Generates per-period amortization schedule
  - Reuses `calculateQuote()` from `lib/lending/quote.ts` for consistent interest calculations
  - Returns structured data with period-by-period breakdown (principal, interest, remaining balance)
  - Handles edge cases: zero interest, single-period terms, long-term loans, rounding
  - Uses same monthly payment formula as the existing quote system
- **`formatCurrency()`**: Utility for consistent currency formatting
- **`shouldCollapseSchedule()`**: Determines when to collapse long schedules (>6 periods)

### 2. UI Component (`components/features/lending/components/AmortizationSchedule.tsx`)

- Displays amortization schedule in an accessible table format
- **Summary Stats**: Shows monthly payment, total interest, and total repayment
- **Schedule Table**:
  - Columns: Period, Principal, Interest, Payment, Balance
  - Accessible semantics with proper ARIA labels and table roles
  - Collapsible for long schedules (shows first 2 and last 2 periods)
  - Expand/collapse button with proper ARIA attributes
- **Responsive Design**: Horizontal scroll for mobile devices

### 3. Integration (`components/features/lending/components/InterestCalculator.tsx`)

- Wired AmortizationSchedule into InterestCalculator
- Only displays for `type === 'borrow'`
- Generates schedule alongside existing calculation
- Maintains all existing functionality for lend mode

### 4. Comprehensive Tests

#### Unit Tests (`lib/lending/amortization.test.ts`)

- **generateAmortizationSchedule**:
  - Standard loan calculation
  - Zero interest rate handling (rejection)
  - Single period term (30 days)
  - Long-term loans (365 days = 13 periods)
  - Final period balance = 0 verification
  - Negative amount rejection
  - Default duration handling
  - Interest distribution over time (front-loaded interest)
  - Consistency with calculateQuote totals
  - Very small amounts
  - High interest rates

- **formatCurrency**: Positive values, zero, decimals, large numbers

- **shouldCollapseSchedule**: Short schedules, exactly 6 periods, >6 periods, very long schedules

#### Component Tests (`components/features/lending/components/AmortizationSchedule.test.tsx`)

- Renders summary correctly
- Displays all periods
- Correct value display
- Expand/collapse functionality
- Collapsed indicator for long schedules
- No expand button for short schedules
- Accessible table semantics (ARIA roles, scope attributes)
- Proper ARIA attributes on interactive elements
- Payment calculation per row
- Zero balance handling

## Key Features

### 1. **No Duplicated Math**

All interest calculations reuse `calculateQuote()` from `lib/lending/quote.ts`, ensuring consistency between the summary and detailed schedule.

### 2. **Accessible Design**

- Proper table semantics with `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`
- `scope="col"` on header cells
- `role="table"` and `aria-label` on table
- `aria-expanded` and `aria-controls` on expand button
- Keyboard accessible (focus management)

### 3. **Collapsible Long Schedules**

- Schedules >6 periods are collapsed by default
- Shows first 2 and last 2 periods with "X more periods" indicator
- Smooth expand/collapse with visual feedback
- Clear button labels with period count

### 4. **Edge Case Handling**

- Zero interest: Properly rejected with validation
- Single period: Works correctly (30-day loan)
- Long-term loans: Handles 365+ day loans
- Rounding: Final period adjusts to ensure balance = 0
- Small amounts: Handles fractional principals
- High rates: Manages high interest scenarios

### 5. **Consistent Formatting**

- All currency values formatted as `$X.XX`
- Matches existing calculator formatting
- Clear visual hierarchy

## Test Coverage

The implementation includes comprehensive tests covering:

- ✅ Standard loan scenarios
- ✅ Edge cases (zero interest, single period, long-term)
- ✅ Rounding and precision
- ✅ Component rendering and interaction
- ✅ Accessibility semantics
- ✅ Expand/collapse functionality
- ✅ Currency formatting

## Files Created/Modified

### Created:

1. `lib/lending/amortization.ts` - Core utility functions
2. `lib/lending/amortization.test.ts` - Unit tests
3. `components/features/lending/components/AmortizationSchedule.tsx` - UI component
4. `components/features/lending/components/AmortizationSchedule.test.tsx` - Component tests

### Modified:

1. `components/features/lending/components/InterestCalculator.tsx` - Integrated amortization schedule

## Usage

The amortization schedule automatically appears when:

1. User selects "borrow" mode
2. Valid amount (>0) and interest rate (>0) are entered
3. Calculation is successful

The schedule shows:

- Monthly payment amount
- Total interest over loan duration
- Total repayment amount
- Period-by-period breakdown of principal vs interest
- Remaining balance after each payment

## Technical Decisions

1. **Reused calculateQuote()**: Ensures interest calculations are identical between summary and schedule
2. **Collapsible UI**: Prevents overwhelming users with long schedules
3. **Type-safe**: Full TypeScript coverage with proper interfaces
4. **Error handling**: Graceful degradation with error messages
5. **Floating point precision**: Handles rounding issues in final period

## Compliance with Requirements

✅ Generates per-period schedule (principal, interest, remaining balance)  
✅ Reuses lib/lending/quote.ts math (no duplicated formulas)  
✅ Collapses long schedules (show first/last with expand)  
✅ Accessible table semantics  
✅ Comprehensive test coverage  
✅ Edge case handling (zero interest, single period, long-term, rounding)  
✅ Clear documentation  
✅ No duplicated interest math

## Next Steps

To run tests:

```bash
# Install dependencies if not already installed
npm install

# Run all tests
npm test

# Run specific test file
npx vitest run lib/lending/amortization.test.ts
npx vitest run components/features/lending/components/AmortizationSchedule.test.tsx

# Run with coverage
npm run test:coverage
```

The implementation is complete and ready for review.
