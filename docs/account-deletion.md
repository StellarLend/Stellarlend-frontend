# Account Deletion (GDPR/CCPA Compliance)

## Overview

The account deletion endpoint provides a GDPR/CCPA-compliant path for users to request deletion of their personal data. The implementation follows a two-phase approach: immediate PII anonymization and retention-respecting async cleanup of derived data.

## API Endpoints

### Step 1: Request a Deletion Challenge

```
GET /api/account/delete/challenge
Authorization: Bearer <jwt>
```

Returns a time-limited challenge string (valid for 5 minutes, single-use).

**Response:**
```json
{
  "challenge": "a1b2c3d4e5f6...",
  "expiresAt": "2026-06-02T05:30:00.000Z",
  "message": "Sign this challenge with your wallet to confirm account deletion"
}
```

### Step 2: Submit Deletion Request

```
DELETE /api/account/delete
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "challenge": "a1b2c3d4e5f6..."
}
```

**Response (200):**
```json
{
  "message": "Account deletion initiated",
  "anonymizedAt": "2026-06-02T05:25:00.000Z",
  "notificationsRemoved": 5,
  "cleanupJobsEnqueued": 3
}
```

## Retention vs Deletion Semantics

### Immediate Deletion (synchronous, < 100ms)

These actions happen during the DELETE request:

| Data Type | Action | Details |
|-----------|--------|---------|
| Profile PII | Anonymized | `displayName` → `[deleted]`, `bio`/`website` → `""`, `timezone` → `"UTC"` |
| Notifications | Removed | All notifications for the user are deleted from the store |
| Sessions | Revoked | Audit event emitted; existing JWTs become orphaned (no server-side store) |
| Audit Event | Created | `account.deleted` event with metadata about the deletion |

### Scheduled Deletion (async, retention-respecting)

These cleanup jobs are enqueued with different retention periods:

| Job Type | Retention | Purpose |
|----------|-----------|---------|
| `clear-cache-entries` | 1 day | Remove cached data associated with the user |
| `remove-derived-data` | 7 days | Delete computed/derived data (positions, transaction history) |
| `anonymize-backups` | 30 days | Anonymize the user's data in backup snapshots |
| `purge-audit-logs` | 90 days | Remove audit log entries (compliance retention) |

### Why Retention Periods Differ

- **Cache entries (1 day):** No compliance requirement; safe to purge quickly.
- **Derived data (7 days):** Allows time for any in-flight operations to complete before removal.
- **Backups (30 days):** Aligns with typical backup rotation cycles; ensures deleted data doesn't persist in restore points.
- **Audit logs (90 days):** Retained for compliance auditing and dispute resolution. The `account.deleted` event itself is preserved for the full retention period to maintain an auditable record that deletion occurred.

### userId Preservation

The `userId` (Stellar wallet address) is **not deleted** from the profile record. Instead, the profile is anonymized in-place. This preserves referential integrity for any on-chain data that references the address while ensuring no PII remains associated with it.

## Security Model

### Re-authentication via Signed Challenge

The two-step challenge flow ensures:

1. **Intent confirmation:** The user must explicitly request a challenge, then submit it back. This prevents accidental deletions from replayed requests.
2. **Session binding:** The challenge is bound to the authenticated user's `userId`. A challenge issued to user A cannot be used by user B.
3. **Time limitation:** Challenges expire after 5 minutes, limiting the window for misuse.
4. **Single-use:** Each challenge is consumed on first use, preventing replay attacks.

### Audit Trail

Every deletion emits two audit events:

1. `sessions.revoked` — records that sessions were revoked as part of deletion
2. `account.deleted` — records the full deletion with metadata (anonymized fields, notification count, cleanup job IDs, duration)

Audit events are stored in-memory and can be queried via `getAuditEvents()`. In production, these should be persisted to an append-only audit log.

## Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing challenge in request body, or malformed JSON |
| 401 | No authentication, invalid token, invalid/expired challenge, or challenge belongs to a different user |
| 500 | No profile found for user, or anonymization failed |

## UI Flow

The frontend provides an `AccountDeletionPanel` component at `components/features/account/components/AccountDeletionPanel.tsx` that implements a two-step deletion flow with typed confirmation:

### Step 1: Initiate

The user clicks **"Delete My Account"** which triggers a `GET /api/account/delete/challenge` request. A loading state (`"Requesting..."`) and `aria-busy` prevent double-submits during the fetch.

On success, a challenge token is received and the confirmation dialog opens.

On failure:
- **429 (rate limit)**: Shows a rate-limit error toast.
- **Other errors**: Shows a generic "Challenge failed" toast with the server's message or a fallback.
- **Network error**: Shows a "Network error" toast.

### Step 2: Typed Confirmation

The confirmation dialog requires the user to type the exact phrase `DELETE` into a text input. The **"Delete My Account"** button remains disabled until the typed phrase matches. A focus trap manages keyboard navigation within the dialog, and `Escape` closes it.

On confirm:
- Sends `DELETE /api/account/delete` with the challenge token in the JSON body.
- A `"Deleting..."` loading state with `aria-busy` prevents double-submits.
- On success, the dialog closes and the user is redirected to `/`.
- On failure, an error toast is shown and the dialog remains open so the user can retry.

### Error handling

All errors are surfaced via the `useToast` system. The component never exposes raw server error strings to the user — status-code-specific or generic fallback messages are used instead.

### Accessibility

- Danger styling (red backgrounds, red text) for all deletion-related UI.
- Focus management: auto-focuses the confirmation input on dialog open, restores focus on close.
- `aria-modal="true"` and `aria-labelledby` on the dialog.
- `aria-busy` on buttons during async operations.

## Implementation Files

- Route: `app/api/account/delete/route.ts` (DELETE handler)
- Challenge: `app/api/account/delete/challenge/route.ts` (GET handler)
- Service: `lib/account/delete.ts` (deletion orchestration)
- Challenge store: `lib/account/challenge-store.ts` (challenge lifecycle)
- Profile repo: `lib/account/repository.ts` (anonymizeByUserId)
- Notifications: `lib/notifications/repository.ts` (removeNotificationsByUserId)
- Audit: `lib/audit/events.ts` (event emission)
- Queue: `lib/queue/cleanup-queue.ts` (async cleanup jobs)
- Tests: `__tests__/api/account/delete.test.ts`
