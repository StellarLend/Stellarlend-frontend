# Account Deletion Tests

This document outlines the testing strategy for `lib/account/delete.ts`.

## Test Cases

1. **Successful Deletion & Anonymization**
   - Asserts `anonymizeByUserId` is called to clear PII fields.
   - Asserts `removeNotificationsByUserId` is called to clear notifications.
   - Asserts sessions are revoked via the `sessions.revoked` audit event emission.
   - Asserts the cleanup queues are triggered.
   - Asserts `account.deleted` audit event is emitted.

2. **Partial Failure & Rollback (Not Found)**
   - Asserts that if the user does not exist, an error is thrown and no downstream systems (audit, cleanup) are triggered.

3. **Anonymization Failure**
   - Asserts that if `anonymizeByUserId` fails, an error is thrown and we don't proceed to emit account deleted events or enqueue further jobs.

4. **Idempotency**
   - Attempting to delete an already deleted account safely fails without adverse side effects.
