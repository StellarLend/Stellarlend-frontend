# Wallet account switcher

Multi-account wallets should expose an account picker in `WalletContext`:

- Persist `activeAccount` in session storage
- Re-fetch balances when the user switches accounts
- Emit analytics events without logging secret keys

UI placement: dashboard TopNav, accessible combobox pattern with keyboard support.
