# Database Schema and Migration Workflow

This document describes the persistent data layer for the frontend, the
Drizzle migration workflow that ships schema changes to staging and
production, and the relationship between the schema source files and the
generated SQL. If you change a column, add a table, or alter an index,
update this guide in the same PR.

The schemas live in `lib/db/schema/`, the generated migrations live in
`drizzle/`, and the runner is `lib/db/migrate.ts`. The Drizzle Kit
configuration is at `drizzle.config.ts`; the GitHub Actions workflow that
invokes the runner in CI is at `.github/workflows/migrate.yml`. The
initial migration in this repo is `drizzle/0000_init.sql` (followed by
`drizzle/0001_transactions_date_id_idx.sql` for the composite index); the
Drizzle journal lives at `drizzle/meta/_journal.json` and the schema
snapshots at `drizzle/meta/`.

## Tables at a glance

| Table | Source | Purpose |
|---|---|---|
| `accounts` | `lib/db/schema/accounts.ts` | Per-user profile data (display name, bio, website, timezone). |
| `sessions` | `lib/db/schema/sessions.ts` | Server-side session records keyed by `id`, with an `expires_at` and `user_id` foreign reference. |
| `notifications` | `lib/db/schema/notifications.ts` | Per-user notification feed (title, message, read flag, type). |
| `transactions` | `lib/db/schema/transactions.ts` | Transaction history rows (id, type, amount, asset, date, time, status) with a composite `(date, id)` index for ordered listing. |
| `audit_events` | `lib/db/schema/audit_events.ts` | Append-only audit log of actor, action, target entity, and a free-form `details` JSON payload. |

The Drizzle schema entry point is `drizzle.config.ts` which currently
points to `./lib/db/schema.ts`. The actual definitions are split per-table
under `lib/db/schema/<name>.ts` and re-exported through `lib/db/schema.ts`
when the entry point is updated. Until the entry point is consolidated,
treat the per-table files as the source of truth.

## Relationship overview

```text
accounts (user_id PK)
  ▲
  │ user_id (FK by convention; no DB-level constraint)
  ├── sessions          (1 account → N sessions)
  ├── notifications     (1 account → N notifications)
  └── audit_events      (1 account → N events; user_id is nullable for anonymous actor)

transactions          (standalone — no account FK; rows are identified by
                       the supplied `id` text and ordered via the
                       `transactions_date_id_idx` composite index)
```

Foreign keys are **not** declared in DDL today; referential integrity is
maintained in the application layer. If you need a join, do it in code
(`SELECT … WHERE user_id = ?`). The composite index on `transactions` is
the only index in the schema:

```text
CREATE INDEX IF NOT EXISTS transactions_date_id_idx
  ON transactions (date, id);
```

This supports the listing page's "newest first" query plan. Any new
transaction query that filters or sorts by a non-`id` column should be
accompanied by a matching index in the same PR.

## Per-table column reference

### `accounts` — `lib/db/schema/accounts.ts`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `text` PK | Matches the authenticated subject. |
| `display_name` | `text` | Public display name. |
| `bio` | `text` | Defaults to `''`. |
| `website` | `text` | Defaults to `''`. |
| `timezone` | `text` | Defaults to `'UTC'`. |
| `updated_at` | `timestamp` | Auto-updated by the application on every write; not a Drizzle `$onUpdate`. |

### `sessions` — `lib/db/schema/sessions.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | Opaque session token. |
| `user_id` | `text` | Owning account; not a DB FK. |
| `expires_at` | `timestamp` | Hard expiry; the auth layer rejects expired rows. |
| `created_at` | `timestamp` | Defaults to `now()`. |

### `notifications` — `lib/db/schema/notifications.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | |
| `user_id` | `text` | Owning account. |
| `title` | `text` | |
| `message` | `text` | |
| `read` | `boolean` | Defaults to `false`. |
| `created_at` | `timestamp` | Defaults to `now()`. |
| `type` | `text` | One of `'info' | 'success' | 'warning' | 'error'`. Defaults to `'info'`. |

### `transactions` — `lib/db/schema/transactions.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | External transaction id (hash). |
| `type` | `text` | Free-form operation type. |
| `amount` | `double precision` | Decimal amount. |
| `asset` | `text` | Asset code or symbol. |
| `date` | `text` | ISO date string (used for ordering). |
| `time` | `text` | ISO time string. |
| `status` | `text` | Free-form status. |

Index: `transactions_date_id_idx (date, id)`.

### `audit_events` — `lib/db/schema/audit_events.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | |
| `user_id` | `text` | Nullable — anonymous events are allowed. |
| `action` | `text` | Stable action identifier (e.g. `tx.submit`). |
| `entity_type` | `text` | Resource type (e.g. `soroban.transaction`). |
| `entity_id` | `text` | Optional specific entity id. |
| `details` | `jsonb` | Free-form payload; never log raw secrets. |
| `created_at` | `timestamp` | Defaults to `now()`. |

## Migration workflow

### Generating a new migration

1. Edit the relevant file under `lib/db/schema/`.
2. Run `npx drizzle-kit generate` to write a new SQL file into `drizzle/`.
   The filename pattern is `NNNN_<description>.sql` and a corresponding
   entry is added to `drizzle/meta/_journal.json` plus a snapshot in
   `drizzle/meta/`. Commit all of these files together — the snapshot and
   journal are how Drizzle detects drift in CI.
3. Open the generated SQL and read it. Drizzle Kit does not understand
   Postgres-only types or destructive renames; you may need to hand-edit
   the SQL (e.g. add `IF EXISTS` guards, change a column type, drop and
   recreate an index). Whatever ends up in the SQL file is what ships, so
   review it line by line.
4. Update the per-table column reference in this document.

### Applying migrations locally

`lib/db/migrate.ts` is the canonical runner. It opens the connection
defined in `lib/db/index.ts`, calls `migrate(db, { migrationsFolder: 'drizzle' })`,
and exits non-zero on failure. Run it with:

```bash
npm run db:migrate
# or, directly:
npx tsx lib/db/migrate.ts
```

The `drizzle/` folder is the source of truth at runtime — never edit the
database schema by hand; always regenerate and check in the SQL.

### Applying migrations in CI

`.github/workflows/migrate.yml` runs on every push to `main` and via
`workflow_dispatch` for ad-hoc staging/production runs. The workflow
targets the `staging` environment by default and can be dispatched against
`production` from the Actions UI. It exports `DATABASE_URL` from
`secrets.DATABASE_URL` and posts the outcome to Slack via
`secrets.SLACK_WEBHOOK_URL`.

The current workflow is a stub that prints success without invoking
`lib/db/migrate.ts`. Until that is wired up, migrations must be applied
manually using the runner from the previous section.

## Drift detection

`codex/openapi-drift-gate` (PR #269 on `Creditra/Creditra-Backend`) is
the model we want to copy here: a CI job that runs `drizzle-kit check`
and fails the build if the checked-in schema source and the snapshot in
`drizzle/meta/` disagree. Until that lands, reviewers should manually
verify that any new schema edit is accompanied by a fresh generated
migration in the same commit.

## Adding a new table

1. Create `lib/db/schema/<name>.ts` using the same imports and `$inferSelect`/
   `$inferInsert` exports as the existing tables.
2. Re-export it from `lib/db/schema.ts` and update `drizzle.config.ts` if
   you want the global schema entry to pick it up.
3. Run `npx drizzle-kit generate` and review the SQL.
4. Add a row to the **Tables at a glance** table and a **per-table
   column reference** section in this document.
5. Add a test in `__tests__/config/database-schema-doc.test.ts` (the
   sync test added alongside this doc) that asserts the table name and
   file path appear in the doc.
6. If the new table has a foreign reference to an existing account, note
   it in the **Relationship overview** diagram.

## Related

- `docs/rate-limiting.md` — request-layer concerns (auth, throttling).
- `docs/observability.md` — how `audit_events` and metrics flow into the
  observability stack.
- `drizzle.config.ts` — Drizzle Kit configuration.
- `lib/db/migrate.ts` — local migration runner.
- `.github/workflows/migrate.yml` — CI migration workflow.
