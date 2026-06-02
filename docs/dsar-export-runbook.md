# Runbook: Account Export (GDPR DSAR Fulfillment)

## Architectural Design Overview
The `/api/account/export` route triggers data collection tasks across core data models (user profiles, parameters, historical payment ledgers, tracking tables). The generated bundle is compressed into an archival `.zip` document, transferred to an isolated cloud environment container, and distributed via time-locked signed URLs.

## Operational Rate-Limiting Controls
To minimize stress on data processing pipelines from arbitrary generation sweeps, a strict **24-hour request limit** is imposed per credential hash token.

## Failure Troubleshooting Vectors
* **S3/Storage Unreachable:** If connection dropouts stall file pushes, the processing task aborts without modifying the rate limiter checkpoint. This ensures users can retry immediately when systems restore.
* **Stale Artifact Cleanup:** Artifact lifecycle policies inside cloud buckets are configured to automatically erase records after 24 hours to prevent permanent data exposure.
