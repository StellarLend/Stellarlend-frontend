# Runbook: Account Export (GDPR DSAR Fulfillment)

## Architectural Design Overview
The `/api/account/export` route triggers data collection tasks across core data models (user profiles, parameters, historical payment ledgers, tracking tables). The generated bundle is compressed into an archival `.zip` document, transferred to an isolated cloud environment container, and distributed via time-locked signed URLs.

## Operational Rate-Limiting Controls
To minimize stress on data processing pipelines from arbitrary generation sweeps, a strict **24-hour request limit** is imposed per credential hash token.

## User-Initiated Export Flow
Users can request an export from the account profile screen through the `DataExportButton`.
The button sends `POST /api/account/export`, enters a disabled busy state while the
archive is generated, and then opens the returned signed `downloadUrl`. The UI announces
the busy state for assistive technology and shows a success or failure toast when the
request completes.

The signed URL returned by the route is short-lived. The UI currently communicates the
15-minute expiry window and reminds users that account exports are limited to one request
per account every 24 hours.

## Failure Troubleshooting Vectors
* **S3/Storage Unreachable:** If connection dropouts stall file pushes, the processing task aborts without modifying the rate limiter checkpoint. This ensures users can retry immediately when systems restore.
* **Stale Artifact Cleanup:** Artifact lifecycle policies inside cloud buckets are configured to automatically erase records after 24 hours to prevent permanent data exposure.
* **UI Request Failure:** If the account page shows an export failure toast, inspect the
  `/api/account/export` response. `403` usually indicates a missing CSRF token, `429`
  indicates the 24-hour account throttle, and `500` indicates export bundle generation
  failed before a signed URL was issued.
