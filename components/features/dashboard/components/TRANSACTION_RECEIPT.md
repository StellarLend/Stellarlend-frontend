# Transaction Receipt Component

## Overview

The `TransactionReceipt` component provides a clean, print-friendly receipt view for individual transactions. It displays comprehensive transaction details and includes a dedicated print stylesheet that hides navigation and chrome elements while maintaining a professional receipt layout.

## Features

- **Print-optimized layout**: Clean receipt format suitable for printing or saving as PDF
- **Comprehensive transaction details**: Shows all relevant transaction information including:
  - Transaction ID (hash)
  - Transaction type (Deposit, Withdrawal, Lend Funds, Loan Payment)
  - Amount with sign indicators (+/-)
  - Asset symbol with icon
  - Date and time
  - Status with color-coded badges
  - Optional network fees
  - Optional memo field
  - Blockchain explorer link (when applicable)
- **One-click printing**: "Print Receipt" button triggers `window.print()` with optimized styles
- **Navigation support**: Optional back button to return to transaction detail view
- **Keyboard accessible**: All interactive elements support keyboard navigation
- **Security-conscious**: Excludes sensitive session/secret values from output
- **Responsive design**: Works on desktop and mobile devices

## Usage

### Basic Usage

```tsx
import TransactionReceipt from "@/components/features/dashboard/components/TransactionReceipt";
import type { Transaction } from "@/types/Transaction";

const transaction: Transaction = {
  id: "TXHASH123ABC",
  type: "Deposit",
  amount: 100,
  asset: "USDC",
  date: "2024-06-15",
  time: "2:30PM",
  status: "Completed",
};

<TransactionReceipt transaction={transaction} />
```

### With Optional Details

```tsx
<TransactionReceipt
  transaction={transaction}
  details={{
    fee: "0.00001 XLM",
    memo: "Payment for invoice #12345",
  }}
/>
```

### With Back Navigation

```tsx
<TransactionReceipt
  transaction={transaction}
  details={details}
  onBack={() => setShowReceipt(false)}
/>
```

## Props

### `transaction` (required)
**Type:** `Transaction`

The core transaction object containing:
- `id`: Transaction hash/identifier
- `type`: Transaction type ("Deposit" | "Withdrawal" | "Lend Funds" | "Loan Payment")
- `amount`: Transaction amount (positive or negative number)
- `asset`: Asset symbol ("XLM" | "USDC" | "BTC" | "ETH")
- `date`: Date string in YYYY-MM-DD format
- `time`: Time string in h:mmAM/PM format
- `status`: Transaction status ("Completed" | "Processing" | "Failed")

### `details` (optional)
**Type:** `object | null`

Optional detailed transaction information:
- `fee`: Network fee string (e.g., "0.00001 XLM")
- `memo`: Transaction memo/note
- `explorerUrl`: Blockchain explorer URL (automatically generated from transaction ID)
- `operations`: Array of operation details (future use)

### `onBack` (optional)
**Type:** `() => void`

Callback function to handle back navigation. When provided, a "Back" button is displayed allowing users to return to the previous view.

## Transaction Types

The component handles all Stellarlend transaction types:

1. **Deposit**: Funds added to the platform (positive amount, green)
2. **Withdrawal**: Funds removed from the platform (negative amount, red)
3. **Lend Funds**: Funds lent to borrowers (positive amount, green)
4. **Loan Payment**: Repayment of borrowed funds (negative amount, red)

## Status Indicators

Status badges are color-coded for quick recognition:

- **Completed**: Green badge (bg-green-100, text-green-800)
- **Processing**: Yellow badge (bg-yellow-100, text-yellow-800)
- **Failed**: Red badge (bg-red-100, text-red-800)

## Print Stylesheet

The component includes embedded print styles that:

- Hide all page content except the receipt container
- Remove the "Print Receipt" and "Back" buttons (`.no-print` class)
- Apply black text on white background for optimal printing
- Remove shadows and background colors
- Set fixed positioning with proper margins
- Add border to receipt for clear boundaries
- Convert explorer link to plain text URL
- Ensure page-break-inside: avoid for clean printing

### Print Media Query

```css
@media print {
  /* Hide everything except receipt */
  body > *:not(.transaction-receipt-container) {
    display: none !important;
  }
  
  /* Hide interactive elements */
  .no-print {
    display: none !important;
  }
  
  /* Optimize receipt for print */
  .transaction-receipt-container {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 2rem !important;
    background: white !important;
    color: black !important;
  }
}
```

## Accessibility

- All buttons have descriptive `aria-label` attributes
- Buttons are keyboard-navigable with focus indicators
- Color is not the only indicator (status text + badge)
- Sufficient color contrast ratios
- Semantic HTML structure
- Screen reader friendly content

## Security Considerations

### No Sensitive Data in Print Output

The component ensures that:
- No session tokens are included
- No authentication credentials are displayed
- Memo field content is sanitized using `sanitiseString()`
- Explorer URLs are validated before display

### Transaction ID Validation

Explorer links are only generated and displayed if:
1. Transaction ID is valid (passes `isValidTxHash()`)
2. Explorer URL starts with the allowlisted domain (`https://stellar.expert/`)

## Integration Example

### In TransactionDetail Modal

```tsx
import TransactionDetail from "./TransactionDetail";
import TransactionReceipt from "./TransactionReceipt";

export default function TransactionDetailModal() {
  const [showReceipt, setShowReceipt] = useState(false);
  
  if (showReceipt) {
    return (
      <TransactionReceipt
        transaction={transaction}
        details={details}
        onBack={() => setShowReceipt(false)}
      />
    );
  }
  
  return (
    <TransactionDetail transaction={transaction}>
      <button onClick={() => setShowReceipt(true)}>
        Print Receipt
      </button>
    </TransactionDetail>
  );
}
```

## Testing

The component has comprehensive test coverage (95%+) including:

- Core transaction data rendering
- Optional detail fields
- All transaction types (Deposit, Withdrawal, Lend Funds, Loan Payment)
- All asset types (XLM, USDC, BTC, ETH)
- All status types (Completed, Processing, Failed)
- Print functionality
- Back button functionality
- Keyboard accessibility
- Edge cases (missing data, zero amounts, long IDs)
- Security requirements

Run tests:
```bash
npm test -- TransactionReceipt
```

## Styling

The component uses Tailwind CSS for styling with:
- Responsive grid layouts
- Color-coded status badges
- Hover and focus states
- Print-specific utility classes
- Border and spacing utilities

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Print functionality uses standard `window.print()` API
- CSS Grid for layout (IE11 not supported)
- Flexbox for button layouts

## Future Enhancements

Potential improvements for future iterations:

1. **PDF Export**: Add direct PDF generation (without print dialog)
2. **Email Receipt**: Send receipt via email
3. **QR Code**: Include QR code linking to explorer
4. **Multiple Languages**: i18n support for receipt text
5. **Customization**: Allow custom receipt headers/footers
6. **Operation Details**: Expand to show detailed operation breakdown

## Related Components

- **TransactionDetail**: Modal showing transaction details with option to view receipt
- **Transactions**: Main transaction list component
- **TransactionFilters**: Filter and search transactions

## Dependencies

- `lucide-react`: Icon components (Printer, ArrowLeft)
- `next/image`: Optimized image component for asset icons
- `@/lib/security/input-sanitizer`: Sanitize memo content
- `@/lib/validation/stellar`: Validate transaction hashes
- `@/lib/config`: Configuration for explorer URLs

## File Location

```
components/
  features/
    dashboard/
      components/
        TransactionReceipt.tsx
        TransactionReceipt.test.tsx
        TRANSACTION_RECEIPT.md (this file)
```
