# Runbook: Account Export (GDPR DSAR Fulfillment)

## Architectural Design Overview
The `/api/account/export` route triggers data collection tasks across core data models (user profiles, parameters, historical payment ledgers, tracking tables). The generated bundle is compressed into an archival `.zip` document, transferred to an isolated cloud environment container, and distributed via time-locked signed URLs.

## Operational Rate-Limiting Controls
To minimize stress on data processing pipelines from arbitrary generation sweeps, a strict **24-hour request limit** is imposed per credential hash token.

## UI Flow
Users can request their data export through the account profile page at `/account/profile`. The DataExportButton component provides a one-click interface:

1. **User clicks "Export My Data" button** - Triggers POST request to `/api/account/export`
2. **Processing state** - Button shows loading spinner with "Preparing..." text, announces busy state to screen readers
3. **Success** - Toast notification confirms download ready, browser automatically downloads the `.zip` file
4. **Rate limit exceeded (429)** - Toast notification shows remaining wait time
5. **Error** - Toast notification displays error message with link to this runbook for troubleshooting

### Accessibility Features
- `aria-busy` attribute announces processing state to assistive technology
- `aria-describedby` links to hidden status text for screen readers
- Toast notifications use `aria-live="polite"` for non-intrusive announcements
- Button disabled during processing to prevent duplicate requests

## Failure Troubleshooting Vectors
* **S3/Storage Unreachable:** If connection dropouts stall file pushes, the processing task aborts without modifying the rate limiter checkpoint. This ensures users can retry immediately when systems restore.
* **Stale Artifact Cleanup:** Artifact lifecycle policies inside cloud buckets are configured to automatically erase records after 24 hours to prevent permanent data exposure.
* **Network Errors:** The UI displays a toast notification with network error guidance. Users should check their connection and retry.
