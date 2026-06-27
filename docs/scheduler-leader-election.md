# Scheduler leader election

`lib/jobs/scheduler.ts` provides a small cron-registration coordinator for multi-replica deployments. It uses a Postgres advisory lock instead of in-memory process state so all replicas agree on a single scheduler leader.

## Registered cron jobs

The cron registry lives in `src/jobs/cron.ts` and currently registers these BullMQ repeatable jobs:

| Entry                  | Queue                      | Job name               | Schedule (UTC) | Purpose                                         |
| ---------------------- | -------------------------- | ---------------------- | -------------- | ----------------------------------------------- |
| `retention`            | `retention-job`            | `daily-retention`      | `0 2 * * *`    | Delete stale audit, session, and snapshot data. |
| `snapshot`             | `snapshot-job`             | `daily-snapshot`       | `0 0 * * *`    | Capture daily wallet position snapshots.        |
| `indexer-health-check` | `indexer-health-check-job` | `indexer-health-check` | `*/5 * * * *`  | Check indexer progress and upstream health.     |

## Recovery behavior

The advisory lock is scoped to the database session held by the leader. If the leader process exits, loses its database connection, or is killed mid-cycle, Postgres releases the lock. Standby replicas retry election periodically; the first standby to acquire the lock becomes leader and runs the idempotent cron registration flow.

Repeatable job registration checks BullMQ for an existing job name before adding it, so re-registration after failover is safe and avoids duplicate schedules. Running or already-enqueued jobs are handled by the queue workers; the scheduler only decides which process is allowed to create or repair repeatable cron definitions.

## Metrics

`/api/metrics` exposes `scheduler_is_leader` as a Prometheus gauge:

- `1` means this replica owns the scheduler advisory lock.
- `0` means this replica is a standby or has released leadership.

Alert if no live replica reports `scheduler_is_leader 1` for longer than the election interval plus database connection timeout.
