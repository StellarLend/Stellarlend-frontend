# TransactionSummary — Copy to Clipboard

## Feature

The **Copy Summary** button serialises the displayed transaction breakdown to plain text and copies it to the clipboard for record keeping, documentation, or support escalation.

Located in the top-right corner of the Transaction Summary component, the button provides visual and accessible feedback throughout the copy operation.

## Usage

### Basic Interaction

1. Click the **Copy Summary** button
2. The button provides real-time feedback:
   - **✓ Copied** — Success state (2 seconds, green background)
   - **✗ Failed** — Failure state with error toast (2 seconds, red background)
3. Button returns to idle state after 2 seconds

### Keyboard Navigation

- **Tab** to navigate to the button
- **Enter** or **Space** to activate
- Button is disabled during copy operation to prevent accidental double-submission

## Plain-Text Format

The exported summary follows a structured plain-text format with consistent spacing for readability:

```
Transaction Summary
==================

Type:               Lending
Asset:              XLM
Amount:             100.0000 XLM
Interest Rate:      5.5% APY
Duration:           30 days
Start Date:         Jun 28, 2026
End Date:           Jul 28, 2026

Expected Returns
----------------
Daily Earnings:     0.1500 XLM
Total Earnings:     4.5000 XLM
Total Return:       104.5000 XLM

Exported at:        2026-06-28T10:30:00.000Z
```

### For Borrowing Transactions

When the transaction type is "borrow", the summary includes:

- **Duration** in days
- **Collateral** section with:
  - Collateral asset type
  - Collateral amount
  - Collateral ratio (e.g., 150%)
- **Repayment Details** instead of Expected Returns:
  - Monthly Payment
  - Total Interest
  - Total Repayment

## Security

### What IS Included

- ✅ All values already visible on screen
- ✅ Formatted amounts and dates
- ✅ Transaction type and asset information
- ✅ Export timestamp (ISO 8601 format)

### What IS NOT Included

- ❌ Session tokens or authentication credentials
- ❌ Wallet private keys or seed phrases
- ❌ Internal API responses or raw data
- ❌ System state or debugging information
- ❌ Any undisplayed calculated values

The serializer only includes display values using the same `formatCurrency()` and `formatDate()` functions that render the UI, ensuring consistency and security.

## Accessibility

### ARIA Support

- **aria-label**: Button label adapts based on copy state
  - Idle: "Copy transaction summary to clipboard"
  - Copied: "Summary copied to clipboard"
- **aria-live="polite"**: Live region announces copy result to screen readers
- **role="status"**: Screen reader status region for copy notifications

### Keyboard Accessibility

- Button is fully keyboard accessible (Tab + Enter/Space)
- Button is disabled during copy operation, preventing repeated clicks
- Visual feedback (button state change) accompanies all interactive changes

### Visual Feedback

- Button text and background color change based on state
- Disabled state includes reduced opacity to indicate unavailability
- Icon changes from Copy icon to checkmark (✓) or X (✗)

## Implementation Details

### Dependencies

```typescript
import { copyToClipboard } from '@/lib/utils/clipboard';
import { Toast } from '@/components/shared/common';
```

### State Management

```typescript
const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
const [toast, setToast] = useState<{
  variant: 'success' | 'error';
  title: string;
  description: string;
} | null>(null);
```

### Copy Handler Flow

1. **Click Detection**: User clicks "Copy Summary" button
2. **Text Serialization**: `buildSummaryText()` builds plain-text summary
3. **Clipboard Operation**: `copyToClipboard(text)` attempts copy
4. **Success Path**:
   - Set `copyStatus` to 'copied'
   - Show success toast: "Copied! Summary copied to clipboard."
   - Disable button (opacity-75, cursor-not-allowed)
   - Auto-reset after 2 seconds
5. **Failure Path**:
   - Set `copyStatus` to 'failed'
   - Show error toast: "Copy Failed" with descriptive message
   - Disable button (opacity-75, cursor-not-allowed)
   - Auto-reset after 2 seconds

### Clipboard Fallback

The implementation uses `lib/utils/clipboard.ts` which provides cross-browser compatibility:

- **Primary**: `navigator.clipboard.writeText()` (modern browsers, secure context)
- **Fallback**: `document.execCommand('copy')` (older browsers, non-secure contexts)
- **Security Check**: Returns `{ success: false, reason: "clipboard_error" }` if both methods fail

See `lib/utils/clipboard.ts` for implementation details.

## Edge Cases

### Empty or Null Values

- Missing optional fields render as `-` in the summary
- Component only renders when `data.amount > 0` and `calculation` is available
- Empty state message: "Summary will appear here once you enter valid details"

### Copy Rejection

- **Invalid Address**: Not applicable (summary text is not address-validated)
- **Clipboard Unavailable**: Shows error toast with message: "Clipboard access is unavailable. Try copying the text manually."
- **Unknown Error**: Shows generic error message: "An unexpected error occurred while copying."

### Repeated Copies

- Button is disabled (`disabled={copyStatus !== 'idle'}`) while copying
- Status automatically resets after 2 seconds
- User can immediately click again after reset

### Browser Compatibility

- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Falls back gracefully in older browsers or non-secure contexts
- See `lib/utils/clipboard.ts` for full browser compatibility matrix

## Testing

### Test Coverage

The test suite (`TransactionSummary.test.tsx`) covers:

1. **Button Rendering** (2 tests)
   - Accessible label present
   - Keyboard accessible (not hidden with `tabindex="-1"`)

2. **Successful Copy** (3 tests)
   - Clipboard utility called with summary text
   - Success toast displayed
   - Button state changes to "Copied"

3. **Clipboard Fallback** (2 tests)
   - Fallback path succeeds when primary API unavailable
   - Failure state shown with error toast

4. **Data Handling** (2 tests)
   - Empty/partial data handled gracefully
   - All displayed fields included in summary

5. **Security** (2 tests)
   - No secrets/tokens in copied text
   - Only visible values included

6. **State Management** (2 tests)
   - Button disabled during copy
   - State resets after 2 seconds

7. **Accessibility** (3 tests)
   - aria-live region present
   - Results announced to screen readers
   - aria-label updates with state

8. **Text Format** (2 tests)
   - ISO timestamp included
   - Amounts properly formatted

### Running Tests

```bash
# Run all tests
npm test

# Run TransactionSummary tests only
npm test TransactionSummary.test.tsx

# Run with coverage
npm test:coverage
```

## Related Files

- **Component**: `components/features/lending/components/TransactionSummary.tsx`
- **Clipboard Utility**: `lib/utils/clipboard.ts`
- **Toast Component**: `components/shared/common/Toast.tsx`
- **Tests**: `components/features/lending/components/TransactionSummary.test.tsx`
- **Storybook**: `stories/TransactionSummary.stories.tsx`

## Troubleshooting

### "Copy Failed" Toast Appears

**Issue**: Copy operation rejected by browser.

**Causes**:
- User denied clipboard permission
- Browser in private/incognito mode without clipboard support
- Non-secure context (non-HTTPS)

**Solution**: Inform user to manually select and copy the summary, or try copying again.

### Button Doesn't Respond to Click

**Issue**: Button appears disabled after copying.

**Expected Behavior**: This is normal. Button is disabled for 2 seconds after a copy attempt to provide clear feedback.

**Solution**: Wait 2 seconds for button to return to idle state, then try again.

### Summary Text Incomplete or Malformed

**Issue**: Copied text is missing fields or has formatting issues.

**Likely Cause**: Component rendering an edge case (empty data, loading state, or null calculation).

**Solution**: Verify that component has valid `data` prop with `amount > 0` and `calculation` is not null. Check console for TypeScript errors.

## Future Enhancements

Possible improvements for future iterations:

- [ ] Export summary as PDF or JSON format
- [ ] Email summary directly
- [ ] Share summary via QR code
- [ ] Customize summary fields (checkboxes for what to include)
- [ ] Copy summary in multiple formats (CSV, JSON, Plain Text)
- [ ] Track copy events for analytics
