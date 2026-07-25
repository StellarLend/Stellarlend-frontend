# Resolved issue: Account export auth and rate-limit isolation

## Title
Fix DSAR export authentication and per-user rate-limit isolation

## Description
The account export endpoint no longer relies on a hardcoded mock user ID. It now resolves the authenticated user from the real session via the auth helper and uses that user ID for the 24-hour throttle key. This prevents cross-user leakage and ensures that one user's export request cannot block another user's export requests with a shared 429 response.

## Verification
- Added regression tests covering unauthenticated access, successful authenticated export, same-user throttling, and separate throttle windows for different users.
