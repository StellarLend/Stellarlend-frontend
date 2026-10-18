# StellarLend Frontend

[![CI](https://github.com/StellarLend/Stellarlend-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/StellarLend/Stellarlend-frontend/actions/workflows/ci.yml)
![Network](https://img.shields.io/badge/network-Stellar%20testnet-5eead4)

**Live demo: [https://stellarlend-frontend.vercel.app](https://stellarlend-frontend.vercel.app)**

StellarLend is an over-collateralised lending market on Stellar (Soroban). This repo is the web UI: a landing page, a markets dashboard with supply / borrow / withdraw / repay flows, Freighter wallet connect, and a docs page.

## Features
- Landing page with protocol stats
- `/markets`: asset table, health factor, borrowing limit, trade panel
- Freighter wallet connect with graceful no-wallet demo mode; testnet XLM balance via Horizon
- `/docs`: user docs, risk parameters, deployed contract list, env vars

## Architecture
Next.js 15 (App Router, React 19, Tailwind 4). Wallet signing via `@stellar/freighter-api`, balances from Horizon, contract IDs from `NEXT_PUBLIC_*` env vars. Positions in this build are a local demo ledger (browser localStorage); on-chain invocation against the lending contract is the next step. Contracts live in [StellarLend/stellarlend-contracts](https://github.com/StellarLend/stellarlend-contracts).

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

## Environment variables
| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon endpoint |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_LENDING_CONTRACT_ID` | Deployed lending contract (testnet) |
| `NEXT_PUBLIC_ORACLE_CONTRACT_ID` | Deployed oracle contract |
| `NEXT_PUBLIC_TOKEN_CONTRACT_ID` | Deployed token contract |

## Deployed contracts (testnet)
Pending: contract IDs from the testnet deployment of stellarlend-contracts will be listed here and set as `NEXT_PUBLIC_*_CONTRACT_ID` in Vercel.

## Deploy
Deployed on Vercel; set the env vars above in the project settings.
