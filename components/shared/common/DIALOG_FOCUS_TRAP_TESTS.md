# Dialog Focus-Trap Tests

**File:** `components/shared/common/__tests__/dialog-focus-trap.test.tsx`

## Scope

Covers focus-trap and ARIA-modal semantics for two account-flow dialogs:

| Component | File |
|-----------|------|
| `SessionExpiryDialog` | `components/shared/common/SessionExpiryDialog.tsx` |
| `AccountDeletionDialog` | `components/shared/common/AccountDeletionDialog.tsx` |

## Test Coverage

### SessionExpiryDialog

| Test | What it verifies |
|------|-----------------|
| ARIA attributes | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` points to visible title |
| Focus on open | Active element is inside the dialog after it opens |
| Tab cycling | Tab wraps from last → first focusable element |
| Shift+Tab at first | Wraps from first → last focusable element |
| Escape closes | Dialog unmounts and focus returns to the trigger button |
| Explicit close | "Log Out" button closes dialog and restores focus |

### AccountDeletionDialog

| Test | What it verifies |
|------|-----------------|
| ARIA attributes | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` points to visible title |
| Focus on open | Active element is inside the dialog after it opens |
| Tab cycling | Tab cycles through Cancel → checkbox → wraps back |
| Shift+Tab at first | Wraps from first → last focusable element |
| Escape closes | Dialog unmounts and focus returns to the trigger button |
| Delete gated on checkbox | Delete button is disabled until confirmation checkbox is checked |
| Explicit cancel | "Cancel" button closes dialog and restores focus |

## Running the Tests

```bash
# Run only the focus-trap suite
npm test -- focus-trap

# Run with coverage
npm test -- --coverage focus-trap
```

## Design Decisions

- Both dialogs follow the same focus-trap pattern as `ConfirmModal` (lending flow): a `keydown` listener on `document` intercepts `Tab`/`Shift+Tab` within the dialog ref and `Escape` to close.
- `previouslyFocusedRef` captures `document.activeElement` at open-time; the `useEffect` cleanup restores it, so both Escape and button-close return focus automatically.
- The `AccountDeletionDialog` delete button is disabled until the user checks the confirmation checkbox, matching the `ConfirmModal` terms-agreement pattern.
