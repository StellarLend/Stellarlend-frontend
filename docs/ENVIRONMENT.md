# Environment Variables

This reference keeps `.env.example`, client bundle safety checks, and server-only configuration in sync. Public variables are available to browser code and must use the `NEXT_PUBLIC_` prefix. Server-only variables must never use that prefix.

## Public Variables

| Variable | Required | Default/example | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Yes | `Stellarlend` | Product name shown by frontend config. |
| `NEXT_PUBLIC_APP_VERSION` | Yes | `1.0.0` | Frontend release/version label. |
| `NEXT_PUBLIC_APP_ENV` | Yes | `development` | Runtime environment: `development`, `staging`, or `production`. |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:3001` | Public API base URL used by frontend requests. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Yes | `testnet` | Stellar network label shown and validated by the frontend. |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | Yes | `https://horizon-testnet.stellar.org` | Public Horizon endpoint for read-only network display and defaults. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Development only | `https://soroban-testnet.stellar.org` | Legacy/public RPC value still validated by config; production traffic should use server relay configuration. |
| `NEXT_PUBLIC_SOROBAN_CONTRACT_ID` | Deployment-specific | placeholder contract id | Contract id displayed by public config. |
| `NEXT_PUBLIC_SESSION_COOKIE` | No | `session` | Cookie name used by client-visible auth helpers. |
| `NEXT_PUBLIC_APP_DOMAIN` | No | `localhost:3000` | Domain used in wallet authentication messages. |
| `NEXT_PUBLIC_GA_TRACKING_ID` | No | placeholder | Optional Google Analytics id. |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | No | placeholder | Optional Mixpanel token. |

## Server-only Variables

| Variable | Required | Default/example | Purpose |
| --- | --- | --- | --- |
| `SOROBAN_RPC_URL` | Yes for relay routes | testnet RPC URL | Server-only Soroban RPC endpoint for transaction relay routes. |
| `STELLAR_HORIZON_URLS` | No | comma-separated testnet URLs | Ordered Horizon fallback list for server-side calls. |
| `PRICE_ORACLE_API_KEY` | Production | placeholder secret | Server-side price oracle credential. |
| `AUTH_SIGNING_SECRET` | Production | placeholder secret | Server auth signing secret used by server config. |
| `AUTH_SECRET` | Production | placeholder secret | Session auth secret used by auth helpers. |
| `AUTH_SESSION_EXPIRY` | No | `24` | Session lifetime in hours. |
| `JWT_SECRET` | Production | placeholder secret | JWT signing fallback for API auth code. |
| `SERVER_TOKEN` | Production | placeholder secret | Bearer token for internal server endpoints. |
| `WEBHOOK_SECRET` | Yes for webhooks | placeholder secret | HMAC secret for transaction webhooks. Do not prefix with `NEXT_PUBLIC_`. |
| `STELLAR_SIGNING_SECRET` | Wallet auth deployments | placeholder secret | Server-side Stellar signing secret. |
| `DATABASE_URL` | Yes for persistence | local Postgres URL | Postgres connection for Drizzle-backed data. |
| `REDIS_URL` | Background jobs | local Redis URL | BullMQ/job cache connection string. |
| `REDIS_HOST` / `REDIS_PORT` | Background workers | `localhost` / `6379` | Host/port fallback for worker Redis connections. |
| `CSRF_COOKIE_NAME` | No | `csrf-token` | CSRF cookie name. |
| `API_RATE_LIMIT_MAX` / `API_RATE_LIMIT_WINDOW_MS` | No | `100` / `60000` | Global API rate limit window. |
| `TX_ACCOUNT_RATE_LIMIT_MAX` / `TX_ACCOUNT_RATE_LIMIT_WINDOW_MS` / `TX_ACCOUNT_RATE_LIMIT_BURST` | No | `30` / `60000` / `60` | Wallet-scoped transaction relay throttling. |
| `RETENTION_DRY_RUN` | No | `true` | Runs retention jobs without destructive writes when true. |
| `AUDIT_RETENTION_DAYS` / `SESSION_RETENTION_DAYS` / `SNAPSHOT_RETENTION_DAYS` | No | `30` | Retention windows for server cleanup jobs. |
| `CIRCUIT_FAILURE_RATE` / `CIRCUIT_MIN_CALLS` / `CIRCUIT_COOLDOWN_MS` | No | `0.5` / `20` / `60000` | Circuit breaker tuning. |
| `ENABLE_CHAOS_INJECTION` | No | `false` | Enables non-production chaos injection helpers. |
| `SENTRY_RELEASE` | No | `local-dev` | Optional Sentry release tag. |
| `STELLAR_INDEXER_ACCOUNT` | No | empty | Optional account filter for transaction indexing. |
| `MEMO_SALT` | No | `stellarlend-default-salt` | Salt for deterministic memo helpers. |
| `STRICT_MEMO_MODE` | No | `false` | Enables strict memo validation path. |
| `SERVER_LOG_LEVEL` | No | `info` | Structured server logging level. |

## Sync Check

`__tests__/config/env-example-sync.test.ts` scans application source for `process.env.*` reads and fails when an app-specific variable is missing from `.env.example`. It intentionally ignores platform-provided variables such as `NODE_ENV`, `CI`, and `NEXT_RUNTIME`.

## Related Guides

- `README.md` for setup instructions.
- `WEBHOOKS.md` for webhook signing and `WEBHOOK_SECRET`.
- `README_AUTH.md` and `docs/AUTH.md` for session and wallet authentication settings.
- `docs/SECRET_SCANNER.md` for client bundle secret checks.
