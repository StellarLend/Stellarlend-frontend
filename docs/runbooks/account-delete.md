# Runbook: Account Deletion

## Purpose

This runbook describes how to handle account deletion requests, troubleshoot failures, and verify compliance with GDPR/CCPA data deletion requirements.

## Trigger

A user requests account deletion through the application UI or API.

## Automated Flow

The deletion is handled automatically by the API:

```
User → GET /api/account/delete/challenge → receives challenge
User → DELETE /api/account/delete { challenge } → deletion initiated
```

No manual intervention is required for standard deletions.

## Verification Steps

### 1. Confirm Deletion Completed

Check the audit log for the `account.deleted` event:

```typescript
import { getAuditEvents } from '@/lib/audit/events';

const events = getAuditEvents({
  userId: '<user-id>',
  type: 'account.deleted',
});
```

The event should contain:
- `anonymizedFields`: list of fields that were anonymized
- `notificationsRemoved`: count of deleted notifications
- `cleanupJobs`: list of scheduled cleanup job IDs
- `durationMs`: time taken for synchronous deletion

### 2. Verify Profile Anonymization

```typescript
import { profileRepository } from '@/lib/account/repository';

const profile = await profileRepository.getByUserId('<user-id>');
// Expected: displayName === '[deleted]', bio === '', website === '', timezone === 'UTC'
```

### 3. Verify Notifications Removed

```typescript
import { getNotifications } from '@/lib/notifications/repository';

const notifications = getNotifications('<user-id>');
// Expected: notifications.length === 0
```

### 4. Check Cleanup Job Status

```typescript
import { getJobsByUserId } from '@/lib/queue/cleanup-queue';

const jobs = getJobsByUserId('<user-id>');
// Expected: 3 jobs (anonymize-backups, remove-derived-data, clear-cache-entries)
// All should be in 'pending' status until their scheduled retention period passes
```

## Troubleshooting

### Deletion Returns 500

**Likely causes:**
- No profile exists for the user (user never created a profile)
- Profile repository error

**Resolution:**
- Check logs for the specific error message
- If "No profile found", the user may have already been deleted — verify via audit log
- If a repository error, check the in-memory store state

### Challenge Returns 401 on DELETE

**Likely causes:**
- Challenge expired (5-minute TTL)
- Challenge already used (single-use)
- Challenge belongs to a different user
- User's session changed between challenge request and deletion

**Resolution:**
- Have the user request a new challenge and retry immediately
- Ensure the same session is used for both requests

### Cleanup Jobs Not Processing

**Cause:** The queue processor is not running automatically in the current setup.

**Resolution:**
- Manually trigger processing:
  ```typescript
  import { startQueueProcessor } from '@/lib/queue/cleanup-queue';
  await startQueueProcessor();
  ```
- In production, set up a cron job or scheduled task to run the processor periodically

### Audit Events Missing

**Cause:** Audit log was cleared (e.g., during testing or restart).

**Resolution:**
- In production, audit events should be persisted to an external store (database, append-only log)
- The in-memory audit log is lost on server restart
- See `lib/audit/events.ts` for the current implementation

## Compliance Notes

### GDPR Right to Erasure (Article 17)

- PII is anonymized immediately upon deletion request
- Derived data is scheduled for deletion within retention windows
- Audit logs retain a record that deletion occurred (legitimate interest for compliance)
- The `userId` (wallet address) is preserved for referential integrity with on-chain data

### CCPA Deletion Request

- Same flow as GDPR
- All personal information is anonymized or scheduled for deletion
- No sale of personal information occurs, so no opt-out verification needed

### Data Retention Schedule

| Data Category | Retention After Deletion |
|---------------|-------------------------|
| Profile PII | Anonymized immediately |
| Notifications | Deleted immediately |
| Cache entries | 1 day |
| Derived data | 7 days |
| Backup copies | 30 days |
| Audit logs | 90 days |

## Escalation

If a deletion request cannot be completed through the API:

1. Check server logs for error details
2. Verify the user's profile exists in the repository
3. If the issue persists, manually anonymize the profile:
   ```typescript
   await profileRepository.anonymizeByUserId('<user-id>');
   ```
4. Manually emit an audit event:
   ```typescript
   emitAuditEvent('account.deleted', '<user-id>', { manual: true, reason: '<reason>' });
   ```
5. Document the manual intervention in the incident log
