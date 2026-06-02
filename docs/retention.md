# Data Retention Policy & Background Job

Stellarlend uses a scheduled background job to clean up stale data from the PostgreSQL database, ensuring database performance, disk usage efficiency, and compliance with data privacy policies.

---

## Retention Policy

The background worker checks three tables for records older than the configured TTL (Time-To-Live) values:

| Table | Purge Criteria Column | Purpose | Default TTL |
| :--- | :--- | :--- | :--- |
| `audit_events` | `created_at` | Administrative and security action logs. | 30 Days |
| `sessions` | `created_at` | Active/expired user sessions. | 30 Days |
| `position_snapshots` | `created_at` | Historical snapshots of user lending/borrowing positions. | 30 Days |

---

## Configuration & Environment Variables

All TTL values and operation modes are configured via environment variables inside `.env.local` or container environments:

* **`AUDIT_RETENTION_DAYS`**
  - **Type:** Number (Integer)
  - **Default:** `30`
  - **Description:** Deletes `audit_events` rows older than this value.
  
* **`SESSION_RETENTION_DAYS`**
  - **Type:** Number (Integer)
  - **Default:** `30`
  - **Description:** Deletes `sessions` rows older than this value.

* **`SNAPSHOT_RETENTION_DAYS`**
  - **Type:** Number (Integer)
  - **Default:** `30`
  - **Description:** Deletes `position_snapshots` rows older than this value.

* **`RETENTION_DRY_RUN`**
  - **Type:** Boolean (`true` / `false`)
  - **Default:** `false`
  - **Description:** When set to `true`, the retention worker counts and logs how many rows *would* be deleted for each table without executing any actual delete queries. Useful for dry-running the process on staging.

---

## Job Scheduling

The background job uses **BullMQ** and runs daily at **02:00 UTC** (`0 2 * * *`). 

- The job is registered at Next.js startup via the root [instrumentation.ts](file:///c:/Users/HP/Stellarlend-frontend/instrumentation.ts) file.
- It runs within a Node.js process using a `QueueScheduler` and `Worker` listening to the `retention-job` queue.
- Deletions are processed in batches of `1,000` rows using parameterized transactions to prevent locking tables or causing database load spikes.

---

## Observability & Metrics

A lightweight metric tracker in [lib/metrics.ts](file:///c:/Users/HP/Stellarlend-frontend/lib/metrics.ts) counts deleted rows:

* **`recordDeletion(table, count)`** - Increments the deletion counter for a given table name.
* **`getDeletionCounts()`** - Returns a dictionary of deletion counts since process start (e.g. `{ audit_events: 1000, sessions: 500 }`).

In a production environment, these counts can be hooked into a Prometheus exporter (e.g. `prom-client`) and scraped to monitor deletion volume and verify that the retention job is performing as expected.
