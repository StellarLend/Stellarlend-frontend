# Database Schema and Migration Workflow

This guide documents the Drizzle-backed database surfaces that support accounts,
sessions, notifications, transactions, and audit events in Stellarlend.

The repository currently has two schema entry points:

- `lib/db/schema/` contains the PostgreSQL table modules used by the server
  database client in `lib/db/index.ts` and the SQL migrations in `drizzle/`.
- `lib/db/schema.ts` contains a smaller SQLite schema used by
  `lib/db/client.ts` for local profile and outbox storage.

The sections below focus on the PostgreSQL schema modules under
`lib/db/schema/`, because those are the tables covered by the existing Drizzle
migrations and backend route tests.

## PostgreSQL Tables

### `accounts`

Source: `lib/db/schema/accounts.ts`

Stores user-facing account profile details.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `user_id` | `text` | Primary key | Stable account identifier shared by account-scoped records. |
| `display_name` | `text` | Required | Name shown in account UI. |
| `bio` | `text` | Required, default `''` | Optional account biography text. |
| `website` | `text` | Required, default `''` | Optional profile website. |
| `timezone` | `text` | Required, default `UTC` | Preferred account timezone. |
| `updated_at` | `timestamp` | Required, default `now()` | Last profile update timestamp. |

### `sessions`

Source: `lib/db/schema/sessions.ts`

Stores server-side session records.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | `text` | Primary key | Session token or session record identifier. |
| `user_id` | `text` | Required | Account identifier for the authenticated user. |
| `expires_at` | `timestamp` | Required | Session expiration timestamp. |
| `created_at` | `timestamp` | Required, default `now()` | Session creation timestamp. |

### `notifications`

Source: `lib/db/schema/notifications.ts`

Stores account-scoped notification messages.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | `text` | Primary key | Notification identifier. |
| `user_id` | `text` | Required | Recipient account identifier. |
| `title` | `text` | Required | Short notification heading. |
| `message` | `text` | Required | Notification body text. |
| `read` | `boolean` | Required, default `false` | Whether the recipient has read the notification. |
| `created_at` | `timestamp` | Required, default `now()` | Creation timestamp used for ordering. |
| `type` | `text` | Required, default `info` | UI severity, currently documented as `info`, `success`, `warning`, or `error`. |

### `transactions`

Source: `lib/db/schema/transactions.ts`

Stores lending, borrowing, deposit, withdrawal, and payment transaction rows for
the transaction list and history views.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | `text` | Primary key | Transaction identifier. |
| `type` | `text` | Required | Transaction category such as deposit, withdrawal, lend, or loan payment. |
| `amount` | `double precision` | Required | Numeric transaction amount. |
| `asset` | `text` | Required | Asset symbol associated with the transaction. |
| `date` | `text` | Required | Date string used by the current transaction views and filters. |
| `time` | `text` | Required | Time string shown in transaction history. |
| `status` | `text` | Required | Processing state shown to the user. |

Indexes:

- `transactions_date_id_idx` on `(date, id)` supports stable date/id ordered
  pagination and history queries.

### `audit_events`

Source: `lib/db/schema/audit_events.ts`

Stores structured security and operational audit records.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | `text` | Primary key | Audit event identifier. |
| `user_id` | `text` | Nullable | Account associated with the event, when available. |
| `action` | `text` | Required | Operation name, such as login or profile update. |
| `entity_type` | `text` | Required | Domain object type affected by the event. |
| `entity_id` | `text` | Nullable | Domain object identifier affected by the event. |
| `details` | `jsonb` | Nullable | Additional structured event metadata. |
| `created_at` | `timestamp` | Required, default `now()` | Event creation timestamp. |

## Relationship Overview

The current schema keeps relationships implicit rather than declaring foreign
keys in Drizzle. Application code should still treat `user_id` as the account
join key for user-scoped data.

```text
accounts.user_id
  |-- sessions.user_id
  |-- notifications.user_id
  |-- audit_events.user_id

transactions
  Standalone transaction history table keyed by id.

audit_events.entity_type + audit_events.entity_id
  Polymorphic reference to the domain object affected by the audited action.
```

## Migration Workflow

### Source of truth

PostgreSQL migrations in `drizzle/` currently reflect the table modules in
`lib/db/schema/`:

- `drizzle/0000_init.sql` creates `accounts`, `sessions`, `notifications`,
  `transactions`, and `audit_events`.
- `drizzle/0001_transactions_date_id_idx.sql` adds
  `transactions_date_id_idx`.
- `drizzle/meta/_journal.json` records the migration journal metadata.

`lib/db/migrate.ts` runs those migrations with
`drizzle-orm/postgres-js/migrator` and the PostgreSQL client exported by
`lib/db/index.ts`.

### Local migration command

Set `DATABASE_URL` to the target PostgreSQL database, then run:

```bash
npm run db:migrate
```

This invokes `ts-node lib/db/migrate.ts`, applies migrations from `drizzle/`,
and closes the PostgreSQL connection in a `finally` block.

### CI and deployment workflow

`.github/workflows/migrate.yml` defines the database migration workflow for
`main` pushes and manual dispatches. It installs dependencies, receives
`DATABASE_URL` from repository secrets, and is structured for environment-scoped
staging or production migration runs.

The workflow currently contains placeholder shell commands for the actual
deployment migration and verification steps. Keep those commands aligned with
`npm run db:migrate` before relying on the workflow as the production migration
path.

### Drizzle Kit note

`drizzle.config.ts` currently points at the SQLite schema entry point
`./lib/db/schema.ts` with `dialect: 'sqlite'`, while the runtime PostgreSQL
migration path uses `lib/db/schema/` and `drizzle/`. If generating new
PostgreSQL migrations with Drizzle Kit, first confirm which schema entry point
and dialect should be used so generated files match the production database
client.

## Change Checklist

When adding or changing a persisted table:

1. Update or add the relevant schema module in `lib/db/schema/`.
2. Add a matching SQL migration in `drizzle/`.
3. Update this document with the table, columns, relationships, and indexes.
4. Update `docs/backend-architecture.md` or the feature-specific guide that
   owns the data flow.
5. Add or update tests that compile representative Drizzle queries.
6. Run `npm test` and `npm run db:migrate` against an appropriate local
   database before shipping.
