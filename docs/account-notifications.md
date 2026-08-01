# Account / dashboard notifications feed

Type tabs and day grouping for the notifications list.

Source: [`NotificationsFeed.tsx`](../components/features/notifications/NotificationsFeed.tsx)

Helpers: [`lib/notifications/grouping.ts`](../lib/notifications/grouping.ts),
[`lib/notifications/types.ts`](../lib/notifications/types.ts)

Tests: [`NotificationsFeed.test.tsx`](../components/features/notifications/NotificationsFeed.test.tsx)

## Where it mounts

- Dashboard page: `app/dashboard/notifications/page.tsx`
- Preferences remain at `app/account/notifications/page.tsx` (channels only)

## Type tabs

| Tab | Filter |
| --- | --- |
| All | every notification |
| Info / Success / Warning / Error | `notification.type` |

- Implemented as a WAI-ARIA **tablist** (arrow keys, Home/End, `aria-selected`, roving `tabIndex`).
- Each tab shows a live count for that type.
- Empty-per-tab shows “No {type} notifications”.

## Day grouping

Uses `groupNotifications` / `getDateGroupLabel`:

| Group | Window |
| --- | --- |
| Today | start of local day → now |
| Earlier this week | start of ISO week → yesterday |
| Older | before this week |
| Pinned | ids in the pinned set (optional) |

Groups with zero items are omitted.

## Read / unread

- Unread rows use stronger weight + slate background.
- **Mark as read** PATCHes `/api/notifications/:id` and optimistically updates local state (rolls back on failure).
