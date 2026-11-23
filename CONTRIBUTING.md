# Contributing to StellarLend Frontend

Thank you for contributing to StellarLend Frontend. This guide covers local setup, available scripts and test suites, repository guardrails, and pull request expectations.

## Setup

CI runs on **Node.js 24** and installs dependencies with lifecycle scripts disabled:

```bash
npm ci --ignore-scripts
```

For local development:

```bash
cp .env.example .env.local
npm run dev
```

The app runs at `http://localhost:3000`. See [README.md](./README.md#environment-variables) for the full list of `NEXT_PUBLIC_*` environment variables.

## Commands

All commands below match `package.json`:

| Command | Script | When to use |
| --- | --- | --- |
| `npm run dev` | `next dev` | Start the local Next.js development server. |
| `npm run build` | `next build` | Verify the production build compiles cleanly. |
| `npm run start` | `next start` | Serve the production build locally. |
| `npm run lint` | `eslint .` | Run ESLint across the repository. |
| `npm run type-check` | `tsc --noEmit` | Run TypeScript type checking without emitting files. |
| `npm run check-lockfile` | `node scripts/check-lockfile.mjs` | Verify `package-lock.json` registry origins and integrity hashes. |
| `npm run check-lending-errors` | `node scripts/check-lending-errors.mjs` | Verify `lib/errors/lending-errors.ts` matches `lib/errors/lending-errors.snapshot.json`. |
| `npm test` | `node scripts/check-lockfile.mjs && vitest run --config vitest.config.ts && node --test scripts/check-lockfile.test.mjs lib/demo-ledger.test.mjs lib/csp.test.mjs scripts/check-lending-errors.node.mjs && node scripts/check-lending-errors.mjs` | Run the full local verification chain (lockfile check, Vitest unit tests, `node --test` suites, and lending error snapshot check). |
| `npm run test:coverage` | `vitest run --config vitest.config.ts --coverage && node --test lib/demo-ledger.test.mjs lib/csp.test.mjs scripts/check-lending-errors.node.mjs && node scripts/check-lending-errors.mjs` | Run unit tests with V8 coverage reporting plus the `node --test` and lending error checks (used in CI). |
| `npm run test:e2e` | `playwright test` | Run Playwright end-to-end browser tests. |
| `npm run test:integration` | `vitest run --config vitest.integration.config.ts` | Run Soroban contract-client integration tests against a local Stellar Quickstart node. |

### Playwright E2E Setup

Before running `npm run test:e2e` for the first time, install the Chromium browser binary:

```bash
npx playwright install chromium
```

On Linux/CI environments that also need OS libraries, run `npx playwright install --with-deps chromium`.

### Contract Integration Tests

`npm run test:integration` requires a local Stellar Quickstart container with Soroban RPC enabled and the lending contract deployed, matching `.github/workflows/integration.yml`:

1. Start the Quickstart container on port `8000`:
   ```bash
   docker run -d --name stellar-quickstart -p 8000:8000 stellar/quickstart:latest --local --enable-soroban-rpc
   ```
2. Wait until `http://localhost:8000/rpc` reports `healthy`.
3. Stage the compiled lending contract WASM at `contracts/stellar_lend_lending.wasm` and run setup:
   ```bash
   npx tsx scripts/integration-setup.ts
   ```
4. Load `.env.integration` and run the suite:
   ```bash
   set -a && source .env.integration && set +a
   npm run test:integration
   ```
5. Stop and remove the container when finished:
   ```bash
   docker rm -f stellar-quickstart
   ```

## Lockfile Registry Check (`scripts/check-lockfile.mjs`)

`npm run check-lockfile` (also run as part of `npm test` and CI) inspects every package entry in `package-lock.json` that defines a `resolved` URL and enforces two rules:

1. The URL origin must be `https://registry.npmjs.org`.
2. Every resolved package must have a non-empty `integrity` hash.

### Why it can fail

- Your local npm configuration (`.npmrc` or `NPM_CONFIG_REGISTRY`) points to a corporate mirror, private registry, or alternative registry.
- A dependency was added from a git URL, local tarball, or registry without an integrity hash.

### How to fix it

1. Ensure npm is using the official public registry:
   ```bash
   npm config get registry
   ```
2. Re-generate `package-lock.json` against `https://registry.npmjs.org`:
   ```bash
   npm install --registry=https://registry.npmjs.org
   ```
3. Verify the lockfile passes:
   ```bash
   npm run check-lockfile
   ```

## Lending Error Snapshot Check (`scripts/check-lending-errors.mjs`)

`lib/errors/lending-errors.snapshot.json` records the contract error codes and names from `StellarLend/stellarlend-contracts` (`stellar-lend/contracts/lending/src/lib.rs`) at a pinned `revision`. `npm run check-lending-errors` compares that snapshot against `LENDING_ERRORS` in `lib/errors/lending-errors.ts` and fails if there are:

- Duplicate error codes in either file
- Contract error codes missing from `lib/errors/lending-errors.ts`
- Extra frontend error codes not present in the snapshot
- Name mismatches between the snapshot and `LENDING_ERRORS`

### Updating the snapshot

When lending contract error codes change in `StellarLend/stellarlend-contracts`:

1. Update `revision` and the `errors` array in `lib/errors/lending-errors.snapshot.json` to match `stellar-lend/contracts/lending/src/lib.rs`.
2. Update the corresponding entries (`name`, `message`, and `hint`) in `lib/errors/lending-errors.ts`.
3. Verify the catalogue and check script pass:
   ```bash
   npm run check-lending-errors
   node --test scripts/check-lending-errors.node.mjs
   ```

## Pull Request Expectations

- **Keep PRs focused:** Submit a single focused PR per issue or change.
- **No build output, binaries, `.vscode/`, or workflow changes:** Do not commit build artifacts (`.next/`, `coverage/`, `playwright-report/`, `test-results/`), executable binaries, `.vscode/` files, or changes under `.github/workflows/` or `.github/actions/`.
- **CI and malware guard:** Every PR must pass `.github/workflows/ci.yml` and `.github/workflows/pr-malware-guard.yml`. The malware guard automatically blocks PRs that add or modify `.github/workflows/`, `.github/actions/`, `.vscode/`, executable binaries, or `package.json` install lifecycle scripts, and flags sensitive files (such as lockfiles and `scripts/`) for maintainer security review.
- **Verify locally before opening a PR:** Run `npm run check-lockfile`, `npm run check-lending-errors`, `npm test`, `npm run lint`, `npm run type-check`, and `npm run build` as appropriate for your changes.
