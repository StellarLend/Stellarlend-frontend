# StellarLend Frontend

[![CI](https://github.com/StellarLend/Stellarlend-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/StellarLend/Stellarlend-frontend/actions/workflows/ci.yml)
![Network](https://img.shields.io/badge/network-Stellar%20testnet-5eead4)

**Live demo: [https://stellarlend-frontend-tau.vercel.app](https://stellarlend-frontend-tau.vercel.app)**

StellarLend is an over-collateralised lending market on Stellar (Soroban). This repo is the web UI: a landing page, a markets dashboard with supply / borrow / withdraw / repay flows, a flash-loan activity page, Freighter wallet connect, and docs.

## Features
- Landing page with protocol stats
- `/markets`: asset table, health factor, borrowing limit, trade panel
- `/flash-loans`: recent on-chain flash-loan and repayment events, fee observations, utilization limit, and pause state
- `/amm`: add/remove AMM liquidity with exact integer previews and Freighter signing
- `/multisig`: multisig governance explorer with signer-gated proposal creation (decoded `ScVal` preview), approval, execution, and cancellation
- Freighter wallet connect with graceful no-wallet demo mode; testnet XLM balance via Horizon
- `/docs`: user docs, risk parameters, deployed contract list, env vars

## Architecture
Next.js 16 (`^16.4.2`, App Router, React 19, Tailwind 4) with `next-intl` locale routing. English is the default and uses unprefixed URLs; Spanish routes use the `/es` prefix. Wallet signing uses `@stellar/freighter-api`, balances come from Horizon, and contract IDs are configured with `NEXT_PUBLIC_*` environment variables. With a wallet on testnet and `NEXT_PUBLIC_LENDING_CONTRACT_ID` set, the XLM market reads positions and submits deposit / borrow / withdraw / repay transactions to the deployed lending contract. Without a wallet (or before the contract is configured) the app falls back to a clearly labelled browser-local demo ledger. Contracts live in [StellarLend/stellarlend-contracts](https://github.com/StellarLend/stellarlend-contracts).

```
app/
  [locale]/
    admin/emergency/page.tsx
    amm/page.tsx
    docs/page.tsx
    flash-loans/page.tsx
    history/page.tsx
    markets/page.tsx
    multisig/page.tsx
    multisig/[id]/page.tsx
    page.tsx
  admin/emergency/page.tsx  /admin/emergency
  amm/page.tsx              /amm
  docs/page.tsx             /docs
  flash-loans/page.tsx      /flash-loans
  governance/page.tsx       /governance
  history/page.tsx          /history
  markets/page.tsx          /markets
  multisig/page.tsx         /multisig
  multisig/[id]/page.tsx    /multisig/[id]
  api/v1/positions/[address]/route.ts  /api/v1/positions/[address]
  api/v1/protocol/route.ts             /api/v1/protocol
components/                  wallet provider, markets app
lib/                         config (env), market data
i18n/                        next-intl routing and request config
messages/                    en and es translations
```

## Public Read API
Read-only, rate-limited JSON endpoints backed by in-memory single-flight TTL caches:

- `GET /api/v1/protocol` — protocol-wide supply, borrow, utilization, and ledger
- `GET /api/v1/positions/[address]` — per-address collateral, debt, and health factor
- `GET /api/v1/markets` — per-market supply/borrow APY, utilization, supply/borrow caps, oracle price, LTV, liquidation threshold, and active status (`bigint` fields are encoded as decimal strings):

```json
{
  "markets": [
    {
      "symbol": "XLM",
      "name": "Stellar Lumens",
      "supplyApy": 3.4,
      "borrowApy": 6.1,
      "utilizationBps": "4440",
      "supplyCap": "0",
      "borrowCap": "0",
      "oraclePrice": "1200000",
      "ltvBps": 7000,
      "liqThresholdBps": 8000,
      "active": true
    }
  ],
  "fetchedAt": "2026-10-19T12:00:00.000Z"
}
```

## Setup
```bash
npm install
cp .env.example .env.local
npm run dev     # http://localhost:3000
npm run build
```

## Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create the production build. |
| `npm run start` | Start the production server. |
| `npm run lint` | Run ESLint across the project. |
| `npm run type-check` | Run TypeScript without emitting files. |
| `npm run check-lockfile` | Verify the lockfile matches the package manifest. |
| `npm test` | Run lockfile, unit, Node, and lending-error checks. |
| `npm run test:coverage` | Run tests with coverage and lending-error checks. |
| `npm run test:e2e` | Run the Playwright end-to-end tests. |
| `npm run test:integration` | Run the Vitest integration tests. |
| `npm run check-lending-errors` | Check lending-contract error definitions against the frontend. |

## Environment variables
| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon endpoint |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_LENDING_CONTRACT_ID` | Deployed lending contract (testnet) |
| `NEXT_PUBLIC_ORACLE_CONTRACT_ID` | Oracle Soroban contract |
| `NEXT_PUBLIC_TOKEN_CONTRACT_ID` | Token Soroban contract |
| `NEXT_PUBLIC_MULTISIG_CONTRACT_ID` | Optional multisig Soroban contract |
| `NEXT_PUBLIC_AMM_CONTRACT_ID` | Deployed AMM pool contract |
| `NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID` | Token A Soroban contract used by the pool |
| `NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID` | Token B Soroban contract used by the pool |
| `NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET` | Optional Token A Horizon asset in `CODE:ISSUER` form |
| `NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET` | Optional Token B Horizon asset in `CODE:ISSUER` form |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Optional network passphrase override |
| `NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URLS` | Optional comma-separated Soroban RPC fallback URLs |
| `NEXT_PUBLIC_XLM_ASSET_ADDRESS` | Optional XLM asset contract address |
| `NEXT_PUBLIC_USDC_ASSET_ADDRESS` | Optional USDC asset contract address |
| `NEXT_PUBLIC_EURC_ASSET_ADDRESS` | Optional EURC asset contract address |
| `NEXT_PUBLIC_BTC_ASSET_ADDRESS` | Optional BTC asset contract address |
| `NEXT_PUBLIC_SITE_URL` | Public site URL |
| `NEXT_PUBLIC_CSP_REPORT_URI` | Optional CSP violation reporting endpoint |
| `NEXT_PUBLIC_ERROR_ENDPOINT` | Optional client error reporting endpoint |
| `NEXT_PUBLIC_ORACLE_MAX_AGE_SECONDS` | Optional testnet maximum oracle price age in seconds |
| `NEXT_PUBLIC_USDC_ISSUER` | Optional USDC testnet asset issuer override |
| `NEXT_PUBLIC_EURC_ISSUER` | Optional EURC testnet asset issuer override |
| `NEXT_PUBLIC_BTC_ISSUER` | Optional BTC testnet asset issuer override |

## Deployed contracts (testnet)
Lending contract (Stellar testnet): [`CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6`](https://stellar.expert/explorer/testnet/contract/CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6)

Set as `NEXT_PUBLIC_LENDING_CONTRACT_ID` in Vercel. Oracle and token contracts are not deployed.

## Deploy
Deployed on Vercel; set the env vars above in the project settings.
