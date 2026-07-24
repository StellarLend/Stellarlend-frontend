# Notification Dismiss Actions

The `NotificationBell` panel lets users remove notifications without leaving the
current page.

## Single Notification Dismiss

- Each notification renders a `Dismiss` button with an accessible label that
  includes the notification title.
- The button calls `DELETE /api/notifications/[id]` for the current user's
  notification.
- The item is removed optimistically. If the request fails, the previous list is
  restored so users do not lose a notification that was not deleted.

## Clear All

- `Clear all` is available when the panel has loaded at least one notification.
- The action deletes every currently loaded notification through the same
  per-notification API route.
- The list is cleared optimistically. If any delete request fails, the full
  previous list is restored.

## Badge Behavior

After notifications are fetched, the unread badge is derived from the local
panel list. Dismissing unread notifications and clearing the list immediately
updates the badge and accessible trigger label.
