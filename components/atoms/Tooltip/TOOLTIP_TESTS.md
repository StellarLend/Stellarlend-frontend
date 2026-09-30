# Tooltip Test Plan

## Component Under Test
`components/atoms/Tooltip/Tooltip.tsx`

## Test File
`components/atoms/Tooltip/Tooltip.test.tsx`

## Prerequisites
- The test must be registered in `vitest.config.ts` under the `accessibility` project's `include` array.
- The component file should be added to the `coverage.include` array to enforce the 95% threshold.

## Setup
- `vi.useFakeTimers()` is called before each test to control the `setTimeout`-based delay (default 300ms).
- `vi.useRealTimers()` is restored after each test to avoid leakage.

## Test Scenarios

### Basic Rendering
| Test | Assertion |
|---|---|
| Renders the trigger child | Trigger element is present in the DOM |
| Tooltip is hidden by default | `role="tooltip"` element is absent |

### Open / Close Triggers
| Test | Assertion |
|---|---|
| Opens on `mouseEnter` after delay | Tooltip appears after `delay` ms; hidden before timer fires |
| Closes on `mouseLeave` | Tooltip hidden immediately on leave |
| Opens on `focus` | Tooltip appears after `delay` ms |
| Closes on `blur` | Tooltip hidden immediately on blur |
| Closes on `Escape` keydown | Tooltip hidden when `Escape` pressed on `document` |

### Accessibility
| Test | Assertion |
|---|---|
| `aria-describedby` wiring when visible | Trigger has `aria-describedby="tooltip-content"` only while tooltip is shown |
| `role="tooltip"` present | Tooltip div has `role="tooltip"` |

### Delay Behaviour
| Test | Assertion |
|---|---|
| Custom delay is respected | Tooltip appears only after the specified `delay` value |

### Positioning
| Test | Assertion |
|---|---|
| All four positions (`top`, `bottom`, `left`, `right`) render | Tooltip is present for each |

### Custom Class Names
| Test | Assertion |
|---|---|
| `className` applied to tooltip | Tooltip div carries the custom class |
| `wrapperClassName` applied to wrapper | Wrapper `div` carries the custom class |

### Edge Cases
| Test | Assertion |
|---|---|
| Rapid hover in/out cancels pending timer | Tooltip does not appear after rapid in/out |
| Hover in/out/in sequence works correctly | Tooltip re-appears on second hover |
| Escape after focus open | Tooltip opens on `focus`, closes on `Escape` |
| Non-Escape keys are ignored | Tooltip stays visible on `Enter` keydown |
| Cleanup pending timeout on unmount | `clearTimeout` is called when component unmounts while timer is active |
| Cleanup keydown listener on hide | `document.removeEventListener` is called when tooltip hides |

## Running the Tests

```bash
npm test -- Tooltip
```

## Coverage Target
Minimum **95%** on lines, functions, branches, and statements for the Tooltip component.
