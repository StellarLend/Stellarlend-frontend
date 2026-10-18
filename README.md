# StellarLend Frontend

[![CI](https://github.com/StellarLend/Stellarlend-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/StellarLend/Stellarlend-frontend/actions/workflows/ci.yml)
![Network](https://img.shields.io/badge/network-Stellar%20testnet-5eead4)

**Live demo: [https://stellarlend-frontend-tau.vercel.app](https://stellarlend-frontend-tau.vercel.app)**

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

## Deployed contracts (testnet)
Lending contract (Stellar testnet): [`CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6`](https://stellar.expert/explorer/testnet/contract/CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6)

Set as `NEXT_PUBLIC_LENDING_CONTRACT_ID` in Vercel. Oracle and token contracts are not deployed.

## Deploy
Deployed on Vercel; set the env vars above in the project settings.
