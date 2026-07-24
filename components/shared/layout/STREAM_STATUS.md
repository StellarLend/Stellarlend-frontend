# Stream Status Indicator

`TopNav` now surfaces the live notification stream state from `useNotificationStream`.

## States

- `connected` → visible label `Live`
- `reconnecting` → visible label `Reconnecting`
- `offline` → visible label `Offline`

## Behavior

- The hook exposes `connectionState` alongside `unreadCount`.
- `reconnecting` is debounced to avoid flicker during brief reconnects.
- `offline` appears only after a longer interruption.
- The indicator includes visible text, an accessible label, and a tooltip so status is not conveyed by color alone.

## Usage

`TopNav` creates a single notification stream subscription and reuses it across the notification UI:

- `unreadCount` is passed to `NotificationBellBase`
- `connectionState` is passed to `StreamStatusIndicator`

This keeps the bell and status indicator in sync without opening multiple SSE connections from the same navigation component.
