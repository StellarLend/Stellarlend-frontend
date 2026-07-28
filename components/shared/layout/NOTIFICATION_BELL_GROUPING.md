# NotificationBell Date Grouping & Pinning

This document describes the date-based grouping, pinning, collapse/expand, and
mark-all-read features added to the `NotificationBell` panel.

## Overview

The `NotificationBell` component (`NotificationBell.tsx`) now:

1. **Fetches notifications** from `GET /api/notifications` when the panel opens.
2. **Groups notifications** into three date buckets via `lib/notifications/grouping.ts`:
   - *Today* — created since midnight local time.
   - *Earlier this week* — since Monday 00:00 local time, excluding today.
   - *Older* — before the start of this week.
3. **Pinned section** — notifications the user has pinned appear in a
   dedicated section above the date groups.
4. **Collapsible groups** — each date-group header is a toggle button with
   `aria-expanded`. Clicking it collapses or expands the group.
5. **Pin / Unpin** — each notification exposes a Pin/Unpin button. Pins are
   persisted in `localStorage` via `useNotificationPins` (key
   `notification-pinned-ids`).
6. **Mark all read** — a header button calls `PATCH /api/notifications/read-all`
   to mark every unread notification as read.
7. **Mark individual read** — each unread notification has a "Mark as read"
   button that calls `PATCH /api/notifications/:id`.
8. **Empty state** — when there are no notifications, the panel shows
   "No notifications yet".
9. **Loading state** — a spinner is shown while the fetch is in progress.
10. **Keyboard support** — `Escape` closes the panel; group toggles are
    standard `<button>` elements that work with keyboard activation.

## New / modified files

| File | Purpose |
|------|---------|
| `lib/notifications/types.ts` | Added optional `pinned` field to `Notification` |
| `lib/notifications/grouping.ts` | Date-bucket logic (`getDateGroup`, `groupNotifications`, `sortGroupedNotifications`) |
| `hooks/useNotificationPins.ts` | `useNotificationPins` hook — read/write pinned IDs to `localStorage` |
| `lib/notifications/repository.ts` | Added `markAllNotificationsRead` backend function |
| `app/api/notifications/read-all/route.ts` | `PATCH /api/notifications/read-all` — marks all unread as read |
| `components/shared/layout/NotificationBell.tsx` | Rewritten with grouping, pinning, collapse, mark-all-read |
| `components/shared/layout/NotificationBell.test.tsx` | Updated to mock `useNotificationPins` |
| `components/shared/layout/NotificationBell.grouping.test.tsx` | Tests for grouping, pinning, collapse, mark-all-read, empty state, edge cases |

## Usage

No prop changes — the component works as before. The panel now automatically
fetches and groups notifications when opened.

### Pin / Unpin

Click the **Pin** link on a notification to move it to the pinned section.
Click **Unpin** to return it to its date group. Pins survive page reloads via
`localStorage`.

### Collapse / Expand groups

Click a group header (*Today*, *Earlier this week*, *Older*) to collapse or
expand that section. The `aria-expanded` attribute reflects the current state.

### Mark all read

Click **Mark all read** in the panel header to mark all unread notifications as
read. The UI updates optimistically after the API responds.

## API

### `PATCH /api/notifications/read-all`

**Auth:** Required (session cookie)

**Response:**
```json
{ "updatedCount": 2 }
```

**Errors:** `401` if no valid session.

## Testing

```bash
# Run all NotificationBell tests
npm test -- NotificationBell

# Run grouping-specific tests only
npm test -- NotificationBell.grouping

# Run with coverage
npm test -- NotificationBell --coverage
```

## Edge cases covered

- **Empty list** — panel shows empty state.
- **All pinned** — only the pinned section renders; no date groups shown.
- **All read** — "Mark all read" button hidden.
- **Mixed read state** — unread items show "Mark as read" button; read items
  hide it.
- **Group boundary at midnight** — `getDateGroup` uses local midnight for the
  "today" threshold.
- **Mark-all-read with mixed read state** — only unread notifications are
  updated; read notifications stay read.
- **401 unauthorized** — panel shows empty state without error.
- **API failure** — panel shows empty state without crashing.
- **Collapse/expand** — toggles with correct `aria-expanded` attribute;
  collapsed items removed from DOM.
