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
