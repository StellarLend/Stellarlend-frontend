# NavigationMenu Test Plan

## Overview
This document outlines the testing strategy for the `NavigationMenu` component, covering link rendering, active-state derivation, and accessibility semantics.

## Test Categories

### 1. Link Rendering Tests
| Test | Description | Status |
|------|-------------|--------|
| Semantic structure | Renders `<nav aria-label="Main navigation"> > <ul> > <li>` hierarchy | ✅ |
| Link filtering | Filters links based on `visibleLinks` prop | ✅ |
| All links rendered | Renders all links when `visibleLinks` is omitted | ✅ |
| Accessible labels | All links have accessible `aria-label` attributes | ✅ |

### 2. Active-State Derivation Tests

#### Route-based Links (links with `path` property)
| Test | Route | Expected | Status |
|------|-------|----------|--------|
| Root route active | `/dashboard` | Dashboard marked active | ✅ |
| Nested route active | `/dashboard/loan` | Loan marked active | ✅ |
| Nested route active | `/dashboard/transactions` | Transactions marked active | ✅ |
| Nested route active | `/dashboard/settings` | Settings marked active | ✅ |
| No match | `/dashboard` for Settings link | Not marked active | ✅ |
| Unknown route | `/unknown-route` | All links inactive | ✅ |
| Dynamic segment | `/dashboard/loan/123` | Loan not marked active (exact match required) | ✅ |
| Multiple matches | `/dashboard` with Dashboard, Cash and receipt, Notification | Only Dashboard marked active | ✅ |

#### Click-based Links (links without `path` property)
| Test | Description | Status |
|------|-------------|--------|
| Click activates | Links without paths become active on click (Fundwallet, Lending) | ✅ |
| localStorage persistence | Active state persists to localStorage on click | ✅ |
| localStorage restore | Active state restores from localStorage on mount | ✅ |

### 3. Accessibility Semantics Tests
| Test | Description | Status |
|------|-------------|--------|
| Nav landmark | Nav has `aria-label="Main navigation"` | ✅ |
| Focus-visible ring | All links have `focus-visible:ring-2` and `focus-visible:ring-[#15A350]` | ✅ |
| Touch target | Links meet minimum touch-target height (`py-3.5`) | ✅ |
| aria-current | Active links receive `aria-current="page"` attribute | ✅ |

### 4. Active Styling Tests
| Test | Description | Status |
|------|-------------|--------|
| Background class | Active link has `bg-[#15A350]/15` class | ✅ |
| Text class | Active link has `text-[#15A350]` class | ✅ |
| Indicator bar | Active indicator has `opacity-100` class | ✅ |
| Inactive indicator | Inactive indicator has `opacity-0` class | ✅ |

### 5. Collapsed State Tests
| Test | Description | Status |
|------|-------------|--------|
| Collapsed layout | `isCollapsed={true}` applies compact layout classes | ✅ |
| Expanded layout | `isCollapsed={false}` shows full link text | ✅ |
| Text hidden | Link text hidden with `sr-only` when collapsed | ✅ |
| Text visible | Link text shown when not collapsed | ✅ |

### 6. Callback Tests
| Test | Description | Status |
|------|-------------|--------|
| onLinkClick | Callback invoked on link click | ✅ |
| Multiple clicks | Each click triggers independent callback | ✅ |

### 7. Edge Cases
| Test | Description | Status |
|------|-------------|--------|
| Empty array | Empty `visibleLinks` renders no items | ✅ |
| Label fallback | Link without explicit label uses link name | ✅ |

## Test Implementation Notes

- Uses `vi.stubGlobal` for window mocking to simulate route scenarios
- Uses `vi.mock` for `next/dynamic` to handle dynamic icon imports
- Uses `vi.mock` for `next/link` to simplify DOM structure in tests
- Tests use `@testing-library/react` with `userEvent` for interactions
- Coverage threshold: 95% lines, functions, statements; 90% branches