# Infrastructure operations

## Cron scheduler leader election

StellarLend schedules background jobs from `src/jobs/cron.ts` through `lib/jobs/scheduler.ts`. Every application replica may start a scheduler instance, but only the replica that acquires the Postgres advisory lock is allowed to register BullMQ repeatable jobs.

### How election works

- On startup, each replica calls `pg_try_advisory_lock($1::integer, $2::integer)` using the shared scheduler lock key.
- The first replica that receives `acquired = true` keeps that database connection open. Postgres advisory locks are session-scoped, so the lock remains held while that connection is alive.
- Non-leaders release their temporary database connection immediately and retry on the election interval.
- The leader registers the cron entries for:
  - retention cleanup (`0 2 * * *`)
  - position snapshots (`0 0 * * *`)
  - indexer health checks (`*/5 * * * *`)
- The local Prometheus gauge `scheduler_is_leader` is set to `1` on the elected replica and `0` on standbys.

### Crash and mid-cycle recovery

If the leader crashes, its process exits and Postgres closes the session that held the advisory lock. Postgres then releases the lock automatically. The next standby election attempt can acquire the lock and re-register the repeatable jobs.

BullMQ repeatable job registration is idempotent: each cron entry checks existing repeatable jobs by name before calling `queue.add`. This means a replacement leader can safely run registration after a crash without duplicating schedules. If a crash happens after a job was enqueued but before the worker finishes it, recovery follows the normal BullMQ worker semantics for that queue; the leader election only protects cron registration so multiple replicas do not create duplicate repeatable schedules.

### Operational checks

1. Scrape `/api/metrics` with the configured bearer token and verify exactly one healthy replica reports `scheduler_is_leader 1`.
2. If no replica is leader, check database connectivity and the scheduler logs for advisory-lock query errors.
3. If more than one replica reports leader status, verify all replicas point at the same Postgres database and are using the same scheduler lock key.
4. After replacing a crashed leader, confirm a standby logs `Acquired cron scheduler leadership` within one election interval.
