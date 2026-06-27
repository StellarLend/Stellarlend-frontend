# Account Deletion Undo Window

## Overview

The `AccountDeletion` component provides a challenge-based account deletion
flow with a **post-confirmation undo window**. After the user confirms deletion
with a server-issued challenge code, a 10-second countdown begins. During that
time the user can click **Undo** to abort the deletion. If the countdown
elapses, the component calls `/api/account/delete` to finalize deletion.

## Files

- `AccountDeletion.tsx` — Main component implementing the flow.
- `AccountDeletionUndo.test.tsx` — Unit tests covering the undo window and
  deletion finalization paths.
- `ACCOUNT_DELETION_UNDO.md` — This document.

## Flow

1. The user clicks **Delete Account** on the account profile page.
2. A modal opens and the UI requests a challenge from
   `GET /api/account/delete/challenge`.
3. The modal displays the returned challenge code, and the user re-enters it
   to confirm intent before clicking **Confirm Delete**.
4. The UI enters the **undo pending** state, displaying a visible countdown
   and an **Undo** button.
5. If the user clicks **Undo**, the flow returns to the confirmation state and
   no deletion request is sent.
6. If the countdown reaches zero, the UI calls `DELETE /api/account/delete`
   with the challenge in the body.
7. On success, the user is logged out via `POST /api/auth/logout` and
   redirected to `/`. On failure, an error message is displayed and the user
   can retry.

## Accessibility

- A hidden `aria-live="polite"` status region announces state changes and the
  remaining countdown time to screen-reader users without interrupting them.
- The countdown value is rendered as visible text so it is also available to
  assistive technologies that read static content.
- Focus is managed by Headless UI's `Dialog`, which traps focus inside the
  modal while it is open.

## Timer Cleanup

All timers are stored in refs and cleared when:

- the user clicks **Undo**,
- the modal is closed,
- the component unmounts.

This prevents orphaned timers or late deletion requests.

## Props

| Prop        | Type       | Required | Description                                                          |
|-------------|------------|----------|----------------------------------------------------------------------|
| `onDeleted` | `() => void` | No       | Optional callback invoked after successful deletion instead of redirecting to `/`. |

## Configuration

The undo window duration is defined by the constant
`UNDO_WINDOW_SECONDS` in `AccountDeletion.tsx` and is currently set to **10
seconds**.

## Testing

Run the focused test suite:

```bash
npm test -- AccountDeletion
```

Coverage requirements:

- Minimum 95% coverage on new/changed lines.
- Edge cases: undo before elapse, window elapse finalizing, navigate-away
  cleanup, deletion request failure, invalid/expired challenge.

## Trade-offs

- The countdown updates every second. For screen-reader users the live region
  announces the initial and final few seconds to stay polite while remaining
  informative.
- The component uses `window.location.href` for redirect when no `onDeleted`
  callback is provided, keeping it usable outside Next.js routing contexts.
