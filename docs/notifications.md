# Notifications Architecture

This document describes the end-to-end flow of in-app notifications, from
publication in the backend to delivery in the browser. Use it when adding a
new producer, consumer, or UI surface that wires into notifications.

For the focused stream/contract reference, see
[`docs/notifications-ui.md`](./notifications-ui.md). For client-side data
fetching conventions, see [`docs/data-fetching.md`](./data-fetching.md).

## End-to-End Flow

```
                 ┌──────────────────────────────────────────────────────────┐
                 │                   Backend (Node.js)                      │
                 │                                                          │
producer ─► repository.addNotification() ──┬─► Drizzle DB (notifications) ─┐
(repository.ts)                            │                                │
                                           └─► notificationHub.publish()   │
                                                (lib/streams/notification-  │
                                                 hub.ts)                     │
                                                 ──► in-process EventEmitter │
                                                     keyed by userId         │
                                                                              │
                          ┌──────────────────────────────────────────────────┘
                          ▼
                 ┌──────────────────────────────────────────────────────────┐
                 │  SSE: /api/notifications/stream                           │
                 │  (app/api/notifications/stream/route.ts)                 │
                 │                                                          │
                 │  - Authenticated per user (session cookie required)      │
                 │  - Subscribes to notificationHub for that user           │
                 │  - Emits `event: notification` + `event: unreadCount`    │
                 │  - Sets `retry: 5000` hint for client reconnect          │
                 └──────────────────────────────────────────────────────────┘
                          │
                          │   text/event-stream (SSE)
                          ▼
                 ┌──────────────────────────────────────────────────────────┐
                 │  Client: useNotificationStream()                         │
                 │  (hooks/useNotificationStream.ts)                         │
                 │                                                          │
                 │  - EventSource("/api/notifications/stream")              │
                 │  - Listens to `unreadCount` + `notification` named events│
                 │  - Reconnect with exponential backoff (1s → 30s cap)      │
                 │  - Resets backoff after `onopen`                          │
                 │  - Cleans up EventSource + timeouts on unmount           │
                 └──────────────────────────────────────────────────────────┘
                ┌───────────────┴────────────────┐
                ▼                                 ▼
   NotificationBell                   NotificationToastBridge
   (components/shared/layout/         (components/shared/common/
    NotificationBell.tsx)              NotificationToastBridge.tsx)
   - Renders unread badge              - Subscribes to onNotification
     (capped at "99+")                 - Filters by priority threshold
   - Aria label exposes count          - Skips already-seen ids
   - Caps UI at 99+ regardless         - Calls showToast()
     of actual count                   - Bounded `seenLimit` set (default 100)
                                       - Seeds "seen ids" via initial GET

   ┌──────────────────────────────┐
   │  GET /api/notifications      │ ◄── on mount, seeds seenIds via
   │  PATCH /api/notifications/:id│     initial notifications list so the
   └──────────────────────────────┘     bell + toasts don't re-notify
                                            already-known items
```

## Components

### 1. NotificationHub — `lib/streams/notification-hub.ts`

In-process pub/sub keyed by `notifications:${userId}`. Built on `EventEmitter`.

| Concern         | Behaviour                                                                              |
| --------------- | -------------------------------------------------------------------------------------- |
| Isolation       | Publish/subscribe is namespaced per user; users cannot leak events to each other.       |
| Single publish  | `publish()` to a user with zero subscribers is a no-op (does not throw).                |
| Unsubscribe     | Returns `unsubscribe()` from `subscribe()`; double-unsubscribe is safe.                |
| Listener count  | `listenerCount(userId)` returns zero after all subscribers have unsubscribed.           |

Event shapes:

```ts
type NotificationEvent =
  | { type: 'notification'; notification: unknown }
  | { type: 'unreadCount'; unreadCount: number };
```

The hub is intentionally in-process. Multi-instance deployments must upgrade
to a Redis / NATS backed hub before scaling horizontally — see issue tracker.

### 2. SSE Route — `app/api/notifications/stream/route.ts`

`GET /api/notifications/stream` requires a valid session cookie (`getUser()`).
On a successful handshake it:

- Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and
  `Connection: keep-alive`.
- Sends a `retry: 5000` comment so the browser knows to wait ~5s on
  automatic reconnect.
- Subscribes to `notificationHub` for the authenticated user.
- Translates hub events into SSE frames:
  - `event: notification\ndata: { ...notification }\n\n`
  - `event: unreadCount\ndata: { unreadCount: number }\n\n`
- Cleans up the subscription when the downstream consumer closes the stream.

The route is wired up in the Server (Node) runtime only — it does not run on
the Edge runtime because `EventEmitter` is not supported there.

### 3. SSE Consumer Hook — `hooks/useNotificationStream.ts`

`useNotificationStream({ onNotification })` returns `{ unreadCount }` and
manages the client side of the connection:

- Opens `new EventSource("/api/notifications/stream")` on mount.
- Listens to:
  - default `message` events → interpret as `{ unreadCount }` updates,
  - named `unreadCount` events → mirror of the default message,
  - named `notification` events → delivered to `onNotification(notification)`.
- Validates each `notification` payload against the `Notification` shape
  (id/userId/title/message/read/createdAt/type) before forwarding. Malformed
  JSON or malformed payloads are silently dropped.
- On `error` it:
  1. Closes the current `EventSource`,
  2. Schedules a reconnect with exponential backoff starting at 1s and
     capped at 30s,
  3. Resets backoff to 1s as soon as a new connection opens (`onopen`).
- On unmount it closes the `EventSource` and clears any pending reconnect
  timer. Rapid successive error events do not create duplicate timers
  because the same close path is reused.

### 4. Unread-Count Syncing

Unread count is the count of `read === false` notifications in the
repository. Two channels keep the UI in sync without polling:

- The bridge calls `notificationHub.publish(userId, { type: 'unreadCount', … })`
  every time a notification is added or marked as read
  (`lib/notifications/repository.ts: addNotification`, `markNotificationRead`).
- The SSE route forwards that event as a named SSE frame
  (`event: unreadCount`).
- The hook updates its local `unreadCount` state for any `unreadCount`
  payload, regardless of whether it arrived via the default `message` or
  the named event.

The unread count is also returned alongside the notification list when the
client bootstraps via `GET /api/notifications`.

### 5. Deduplication

Both the bell and the toast bridge dedupe by `notification.id`. The bridge
maintains a bounded `seenIds` set (default 100) used to:

- Suppress double-toasts when the same notification arrives via SSE while
  already seeded from the initial `GET /api/notifications` list.
- Evict oldest ids when the set exceeds `seenLimit` (default
  `DEFAULT_NOTIFICATION_TOAST_SEEN_LIMIT = 100`) so memory does not grow
  unbounded for long-lived tabs.

The toast bridge additionally filters out `notification.read === true` and
anything below the configured priority threshold
(`DEFAULT_NOTIFICATION_TOAST_PRIORITY_THRESHOLD = "warning"` overridable via
`NEXT_PUBLIC_NOTIFICATION_TOAST_PRIORITY_THRESHOLD`). The filter is
size-based — a `warning` is treated as more important than `info` etc.

### 6. Mark-as-Read

The full mark-as-read flow:

1. UI calls `PATCH /api/notifications/:id` with the notification id.
2. The route (`app/api/notifications/[id]/route.ts`) authenticates the user,
   then delegates to `lib/notifications/repository.ts:
   markNotificationRead`.
3. The repository updates the row, then publishes
   `{ type: 'unreadCount', unreadCount }` to the hub so any open SSE consumer
   can re-render the badge.
4. The client either re-fetches the list or trusts the `unreadCount` event.

The route is CSRF-protected (`withCsrfProtection`). The repo enforces
per-user isolation by storing rows under `${userId}-${id}` and filtering
lookups by `userId`.

## API Surface Summary

| Method | Path                            | Auth     | Notes                                            |
| ------ | ------------------------------- | -------- | ------------------------------------------------ |
| `GET`  | `/api/notifications`            | Required | Returns `{ notifications, unreadCount }`.        |
| `GET`  | `/api/notifications/stream`     | Required | SSE: emits `notification` + `unreadCount`.       |
| `PATCH`| `/api/notifications/:id`        | Required | Marks the notification read; publishes new count.|

## Conventions for New Producers

- Always go through `lib/notifications/repository.ts:addNotification(userId,
  …)` so the hub gets notified. Don't write directly to the SSE route.
- Keep `notification.id` stable and unique per user — the dedup layer relies
  on it.
- Avoid emitting huge payloads via SSE; large `notification` blobs trigger
  noticeable re-renders.
- If you need to broadcast a system-wide alert, add a new event type to the
  hub contract and document it here.

## Conventions for New Consumers

- Use the `useNotificationStream({ onNotification })` hook so reconnect and
  payload validation are handled for you.
- Maintain your own `seenIds` set if you render anything outside the bell or
  the toast bridge — the bridge's set is module-local.
- Always prefer the SSE push over polling; the unread count comes "for free"
  on every add/mark-read.
- If you must poll, hit `GET /api/notifications` (≤ once per minute) — it
  returns the canonical list + count.

## Operational Notes

- The SSE route is per-request; Chromium and Firefox cap open SSE streams
  per origin (~6). The hub tolerates this by exposing
  `listenerCount(userId)` for diagnostics.
- The current implementation uses an in-memory hub and an in-memory
  notifications store seeded on first read. Multi-instance deployments need
  a Redis-backed hub and a Postgres-backed list before horizontal scaling.
- The BullMQ `notifications-queue` worker
  (`src/jobs/notifications.worker.ts`) is the offline fan-out path —
  producers can call `enqueueNotification(userId, …)` instead of inline
  emit when reliability matters more than latency.
