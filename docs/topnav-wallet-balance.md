# TopNav Wallet Balance Summary

The TopNav wallet balance summary gives connected users a compact account
balance view without leaving the dashboard.

## Data Sources

- Wallet connection state comes from `hooks/useWallet.ts`.
- Balances are loaded from Horizon using the connected account:
  `/accounts/:accountId`.
- Asset labels and display precision come from `lib/assets/registry.ts`.

The popover never blocks TopNav rendering. Balance loading starts only when the
summary is opened for a connected wallet.

## States

- Disconnected: the popover explains that a wallet must be connected.
- Loading: the popover shows a lightweight status message while Horizon loads.
- Success: balances render per asset, with XLM first and other symbols sorted.
- Empty: a connected account with no returned balances shows an empty message.
- Error: Horizon failures show an inline error but keep the navigation usable.

Unknown asset codes remain visible with fallback metadata and an `unregistered`
label so users can still inspect the raw balance.

## Accessibility

- The trigger exposes `aria-label="Wallet balances"`.
- The panel uses `role="dialog"` and a descriptive label.
- Escape closes the panel and returns focus to the trigger.
- The close action is keyboard operable.
