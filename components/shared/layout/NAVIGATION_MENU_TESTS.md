# NavigationMenu Test Plan

## Overview
This document outlines the testing strategy for the `NavigationMenu` component, covering link rendering, active-state derivation, and accessibility semantics.

## Test Categories

### 1. Link Rendering Tests
- Semantic structure: `<nav aria-label="Main navigation"> > <ul> > <li>` 
- Filtering by `visibleLinks` prop
- All links have accessible `aria-label` attributes
- Renders all links when `visibleLinks` is omitted

### 2. Active-State Derivation Tests

#### Route-based Links (links with `path` property)
- Root route `/dashboard` marks Dashboard as active
- Nested route `/dashboard/loan` marks Loan as active
- Nested route `/dashboard/transactions` marks Transactions as active
- Nested route `/dashboard/settings` marks Settings as active
- Non-matching paths do not mark links as active

#### Click-based Links (links without `path` property)
- Links without paths become active on click (e.g., "Fundwallet", "Lending")
- Active state persists to localStorage
- Active state restores from localStorage on mount

### 3. Accessibility Semantics Tests
- Nav landmark has `aria-label="Main navigation"`
- All links have `focus-visible:ring-2` and `focus-visible:ring-[#15A350]` classes
- Links meet minimum touch-target height (`py-3.5`)
- Active links receive `aria-current="page"` attribute

### 4. Active Styling Tests
- Active styling uses class/attribute checks, not color alone
- Active indicator bar has `opacity-100` class (not just color)
- Inactive indicator bar has `opacity-0` class

### 5. Collapsed State Tests
- `isCollapsed={true}` applies compact layout classes
- Link text hidden with `sr-only` when collapsed
- `isCollapsed={false}` shows full link text

### 6. Callback Tests
- `onLinkClick` callback invoked on link click
- Each click triggers independent callback invocation

### 7. Edge Cases
- Dynamic segment routes (e.g., `/dashboard/loan/123`) - exact match required for active state
- Multiple candidate matches - uses exact path matching (only Dashboard matches `/dashboard`)
- Empty `visibleLinks` array renders no items
- Label fallback to link name

## Test Implementation Notes

- Uses `vi.mock` for `next/dynamic` to handle dynamic icon imports
- Tests use `@testing-library/react` with `userEvent` for interactions
- Coverage threshold: 95% lines, functions, statements; 90% branches