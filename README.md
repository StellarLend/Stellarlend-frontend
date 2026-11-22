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
- Freighter wallet connect with graceful no-wallet demo mode; testnet XLM balance via Horizon
- `/docs`: user docs, risk parameters, deployed contract list, env vars

## Architecture
Next.js 15 (App Router, React 19, Tailwind 4). Wallet signing via `@stellar/freighter-api`, balances from Horizon, contract IDs from `NEXT_PUBLIC_*` env vars. With a wallet on testnet and `NEXT_PUBLIC_LENDING_CONTRACT_ID` set, the XLM market reads positions and submits deposit / borrow / withdraw / repay transactions to the deployed lending contract. Without a wallet (or before the contract is configured) the app falls back to a clearly labelled browser-local demo ledger. Contracts live in [StellarLend/stellarlend-contracts](https://github.com/StellarLend/stellarlend-contracts).

```
app/            routes (/, /markets, /docs)
components/     wallet provider, markets app
lib/            config (env), market data
```

## Setup
```bash
npm install
cp .env.example .env.local
npm run dev     # http://localhost:3000
npm run build
```

## TypeScript 7 and ESLint compatibility

TypeScript 7.0 does not provide the classic JavaScript compiler API that
`eslint-config-next` / `typescript-eslint` still use. To keep the native
TypeScript 7 `tsc` and a working ESLint parser, we deliberately install two
compiler versions:

- `@typescript/native` is an npm alias for `typescript@7.0.2` and provides
  the `tsc` CLI used by `npm run type-check` and the build.
- `typescript` is an npm alias for `@typescript/typescript6@6.0.2` and provides
  the TypeScript 6 compiler API used by `typescript-eslint`. This package
  intentionally provides a `tsc6` CLI rather than replacing the native `tsc`.

Do not replace the TypeScript 6 alias with TypeScript 7 or update these packages
independently. Dependabot ignores both aliases until the parser officially
supports TypeScript 7. Revisit the pairing when it does.

After changing either alias, regenerate the npm lockfile with `npm install`
and verify `npm run check-lockfile`, `npm run lint`, `npm run type-check`,
`npm run build`, and `npm test`.

Reference: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60

## Environment variables
| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon endpoint |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_LENDING_CONTRACT_ID` | Deployed lending contract (testnet) |
| `NEXT_PUBLIC_AMM_CONTRACT_ID` | Deployed AMM pool contract |
| `NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID` | Token A Soroban contract used by the pool |
| `NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID` | Token B Soroban contract used by the pool |
| `NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET` | Optional Token A Horizon asset in `CODE:ISSUER` form |
| `NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET` | Optional Token B Horizon asset in `CODE:ISSUER` form |

## Deployed contracts (testnet)
Lending contract (Stellar testnet): [`CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6`](https://stellar.expert/explorer/testnet/contract/CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6)

Set as `NEXT_PUBLIC_LENDING_CONTRACT_ID` in Vercel. Oracle and token contracts are not deployed.

## Deploy
Deployed on Vercel; set the env vars above in the project settings.
