# Database schema

StellarLend uses **Drizzle ORM** with SQLite (local/dev) and migrations under `lib/db/`.

## Workflow

1. Edit schema modules in `lib/db/schema/`.
2. Generate migrations: `npm run db:migrate` (see `lib/db/migrate.ts`).
3. Apply migrations before starting the app in production.

## Key tables

- Account preferences and notification settings
- Transaction history snapshots
- Market cache metadata

See `lib/db/schema/__tests__/schema.test.ts` for table shape assertions.
