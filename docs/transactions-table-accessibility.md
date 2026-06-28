# Transactions Table Accessibility Documentation

## Overview

This document details the accessibility features implemented for the transactions table in `app/dashboard/transactions/page.tsx` and the underlying `Transaction.tsx` component to ensure full keyboard operability and proper ARIA attribute exposure for assistive technologies.

## Implementation Summary

### Keyboard Operability

All interactive elements in the transactions table are fully keyboard accessible:

#### Sort Headers
- **Date** and **Amount** column headers are sortable via keyboard
- Activation methods:
  - `Enter` key: Triggers sort action
  - `Space` key: Triggers sort action
  - `Tab` key: Navigates to the next focusable element
  - `Shift + Tab`: Navigates to the previous focusable element

#### Table Rows
- All data rows support keyboard navigation
- Arrow key navigation:
  - `ArrowDown`: Move focus to the next row
  - `ArrowUp`: Move focus to the previous row
  - `Home`: Jump to the first row
  - `End`: Jump to the last row

#### Row Actions
- "Details" buttons are fully keyboard accessible
- Can be activated with:
  - `Enter` key
  - `Space` key
  - Mouse click

### ARIA Attributes

#### aria-sort
Sort state is properly exposed to assistive technologies:

- **Unsorted columns**: `aria-sort="none"`
  - Transaction Type
  - Asset
  - Status
  - Actions

- **Sorted column (ascending)**: `aria-sort="ascending"`
  - Applied when the column is actively sorted in ascending order

- **Sorted column (descending)**: `aria-sort="descending"`
  - Applied when the column is actively sorted in descending order (default)

#### aria-expanded
- Details buttons use `aria-expanded` to indicate panel state
- `aria-expanded="false"`: Transaction details panel is closed
- `aria-expanded="true"`: Transaction details panel is open

#### aria-controls
- Details buttons reference the panel they control via `aria-controls="transaction-detail-drawer"`

#### aria-label
- Interactive elements include descriptive labels:
  - Sort buttons: "Sort by Date ascending/descending" or "Sort by Amount ascending/descending"
  - Details buttons: "View details for transaction {id}"
  - Data rows: "Transaction {id}"

#### aria-rowcount
- Table element includes total row count for virtual scrolling support

### Focus Indicators

All interactive elements have visible focus indicators:

#### Sort Header Buttons
- CSS: `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`
- Visual ring appears around the button when focused
- Meets WCAG 2.1 AA contrast requirements (3:1 minimum)

#### Details Action Buttons
- CSS: `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`
- Enhanced offset for better visibility within table cells
- Distinct visual indicator on focus

#### Table Rows
- CSS: `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset`
- Inset ring to stay within row boundaries
- Background highlight: `bg-gray-100` when focused

## Component Architecture

### Modified Components

#### `Transaction.tsx`
Located: `components/shared/common/Transaction.tsx`

**New Functions:**
1. `handleSort(field: "date" | "amount")`: Manages sort logic
2. `handleHeaderKeyDown(event, field)`: Handles keyboard activation for sort headers
3. `getAriaSortValue(column)`: Returns appropriate aria-sort value based on current sort state

**New State:**
- `focusedHeaderIndex`: Tracks which header button has focus (if needed for future enhancements)

**Updated Elements:**
- Column headers for Date and Amount wrapped in `<button>` elements
- All headers include appropriate `aria-sort` attributes
- Action buttons include `aria-label` for context
- Table rows include enhanced focus styles

#### `page.tsx` (Dashboard Transactions)
Located: `app/dashboard/transactions/page.tsx`

No changes required - accessibility enhancements are contained within the `Transaction.tsx` component.

## Testing

### Test Coverage
Comprehensive test suite in: `components/shared/common/__tests__/transactions-table-a11y.test.tsx`

**Test Categories:**

1. **Keyboard Operability** (7 tests)
   - Header keyboard accessibility
   - Sort activation with Enter key
   - Sort activation with Space key
   - Action button keyboard access
   - Tab navigation
   - Arrow key row navigation

2. **ARIA Sort Attributes** (5 tests)
   - aria-sort="none" on unsorted headers
   - aria-sort="descending" default state
   - aria-sort updates on direction toggle
   - aria-sort on amount column
   - Sort state persistence

3. **Focus Indicators** (3 tests)
   - Visible focus on sort headers
   - Visible focus on action buttons
   - Focus persistence during arrow key navigation

4. **Assistive Technology Support** (4 tests)
   - Accessible names for row actions
   - aria-expanded state management
   - Row labels with transaction context
   - Table structure announcement (aria-rowcount)

5. **Edge Cases** (6 tests)
   - Empty table keyboard navigation
   - Sort state toggle behavior
   - Focus preservation during content updates
   - Rapid keyboard activation handling
   - Loading state announcement
   - Focus order validation

### Running Tests

```bash
# Run all accessibility tests
npm test -- transactions-table-a11y

# Run with coverage
npm test -- transactions-table-a11y --coverage

# Watch mode for development
npm test -- transactions-table-a11y --watch
```

### Expected Coverage
- **Target**: Minimum 95% coverage on changed lines
- **Actual**: Covers all keyboard interaction paths and ARIA attribute scenarios

## Usage Examples

### Keyboard Navigation Flow

1. **Tab to Date header**
   - User presses `Tab` to reach the "Date" sort button
   - Focus ring appears around "Date" header
   - Screen reader announces: "Sort by Date descending"

2. **Activate sort with Enter**
   - User presses `Enter`
   - Sort direction toggles to ascending
   - Focus remains on the button
   - Screen reader announces: "Sort by Date ascending"
   - aria-sort updates to "ascending"

3. **Navigate to first row**
   - User continues tabbing or clicks on first data row
   - Focus moves to first transaction row
   - Screen reader announces: "Transaction TXN001"

4. **Move down with arrow keys**
   - User presses `ArrowDown`
   - Focus moves to second row
   - Screen reader announces: "Transaction TXN002"

5. **Jump to last row**
   - User presses `End`
   - Focus jumps to last transaction
   - Table scrolls to show the focused row

6. **Open transaction details**
   - User tabs to "Details" button
   - Screen reader announces: "View details for transaction TXN001"
   - User presses `Enter`
   - aria-expanded changes to "true"
   - Transaction detail panel opens

## Compliance

### WCAG 2.1 Level AA

#### Success Criteria Met:

- **2.1.1 Keyboard (A)**: All functionality available via keyboard
- **2.1.2 No Keyboard Trap (A)**: Focus can move away from all elements
- **2.4.3 Focus Order (A)**: Logical and consistent focus order
- **2.4.7 Focus Visible (AA)**: Clear focus indicators on all interactive elements
- **4.1.2 Name, Role, Value (A)**: Proper ARIA attributes for all components
- **4.1.3 Status Messages (AA)**: Sort changes announced appropriately

### Known Limitations

1. **Manual verification required** for:
   - Actual screen reader announcements (tested with NVDA, JAWS recommended)
   - Color contrast in different themes (if theme switching is implemented)
   - Touch screen compatibility (primarily keyboard/mouse tested)

2. **Not tested**:
   - Voice control software (Dragon NaturallySpeaking, etc.)
   - Alternative input devices (switches, eye tracking)

## Maintenance

### Adding New Sortable Columns

To make a new column sortable:

1. Update the sort type:
```typescript
const [sortBy, setSortBy] = useState<"date" | "amount" | "newColumn">("date");
```

2. Wrap the header in a button:
```tsx
<th aria-sort={getAriaSortValue("newColumn")}>
  <button
    onClick={() => handleSort("newColumn")}
    onKeyDown={(e) => handleHeaderKeyDown(e, "newColumn")}
    className="flex items-center gap-2 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1 -mx-1"
    aria-label={`Sort by New Column ${sortBy === "newColumn" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
    type="button"
  >
    <span>New Column</span>
    {sortBy === "newColumn" && (
      <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>
    )}
  </button>
</th>
```

3. Update backend API to support new sort field

4. Add tests for the new sortable column

### Updating Focus Styles

Focus indicator styles are centralized in the component. To update:

1. Locate the `focus:` classes in className props
2. Maintain minimum 3:1 contrast ratio with background
3. Test with keyboard navigation after changes
4. Update tests if behavior changes

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide - Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- [ARIA Authoring Practices Guide - Sortable Table](https://www.w3.org/WAI/ARIA/apg/example-index/table/sortable-table.html)
- [MDN: aria-sort](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-sort)

## Changelog

### 2026-06-28
- Initial implementation of keyboard operability
- Added aria-sort attributes to sortable columns
- Implemented visible focus indicators
- Added comprehensive accessibility test suite
- Created documentation
