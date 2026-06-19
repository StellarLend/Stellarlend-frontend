# Notifications UI Contract

The notification center marks individual notifications as read through:

```text
PATCH /api/notifications/:id
```

The route requires an authenticated user and a CSRF-valid mutating request.
The `:id` route parameter is trimmed before lookup. Blank IDs return `400`.

Successful responses return the updated notification:

```json
{
  "notification": {
    "id": "notif-1",
    "userId": "user-1",
    "title": "Deposit Confirmed",
    "message": "Your deposit settled.",
    "read": true,
    "createdAt": "2026-06-20T00:00:00.000Z",
    "type": "success"
  }
}
```

The repository is called with the authenticated `user.id` and the notification
ID, so unknown IDs and IDs owned by another user return the same `404` response.
