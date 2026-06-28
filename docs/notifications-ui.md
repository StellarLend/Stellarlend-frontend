# Notifications UI

## Stream Contract

The notification system uses `lib/streams/notification-hub.ts` — an in-memory `EventEmitter` keyed by `notifications:${userId}`.

**Events:**

| Type          | Shape                                         |
| ------------- | --------------------------------------------- |
| `notification`| `{ type: 'notification', notification: any }` |
| `unreadCount` | `{ type: 'unreadCount', unreadCount: number }`|

**Guarantees:**

- Publish fan-outs to all subscribers of that user only (cross-user isolation).
- Each `subscribe()` returns an unsubscribe function that fully removes the listener.
- Listener count for a user key returns to zero after all subscribers unsubscribe.
- Double-unsubscribe is safe (no-op).
- Publishing with no subscribers is a no-op (does not throw).

## NotificationCenter UI Component

`components/features/notifications/NotificationCenter.tsx` is the header bell widget that consumes both the REST API and the SSE stream.

### API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notifications` | GET | Initial load of notification list and unread count |
| `/api/notifications/stream` | GET (SSE) | Live push of new notifications and unread count updates |
| `/api/notifications/[id]` | PATCH | Mark a single notification as read |

### Component Behaviour

1. **Mount**: fetches `GET /api/notifications`. On `401` the bell hides itself entirely; on network error the bell still renders with an empty list.
2. **Live updates**: `useNotificationStream` subscribes to the SSE stream. New `notification` events prepend the item to the list; duplicate IDs are dropped. The `aria-live` region announces each arrival to screen readers.
3. **Mark as read**: clicking "Mark as read" applies an optimistic update (sets `read: true` locally, decrements the badge), then sends `PATCH /api/notifications/[id]`. On failure the optimistic update is reverted.
4. **Keyboard**: Escape closes the panel and returns focus to the bell trigger. The panel has `role="dialog"` and `aria-label="Notifications panel"`.

### State Ownership

`unreadCount` is computed directly from the local `notifications[]` array (filtering `!n.read`). SSE `unreadCount` events from the stream are used only by `useNotificationStream` internally; they do not override the local count. This keeps badge state consistent with the displayed list.

### Auth Guard

`NotificationCenter` is rendered conditionally in `Header.tsx` when `address` (wallet) is truthy. Additionally, if a `GET /api/notifications` call returns `401` mid-session (e.g., session expiry), the component sets `hidden = true` and removes itself from the DOM without crashing.
