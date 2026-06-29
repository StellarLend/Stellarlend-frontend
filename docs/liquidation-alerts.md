# Liquidation Alert Subscriptions

`LiquidationsPanel` stores row-level alert subscriptions in the account notification preferences API. Each subscribed row is saved as a stable key:

```text
liquidation:<borrowedAsset>:<collateralAsset>
```

The panel reads `GET /api/account/notification-preferences?userId=<wallet>` when a wallet address is available, then persists changes with `PUT /api/account/notification-preferences`. Toggling is optimistic, but failed saves roll the switch back and show an inline error.

Rows render disabled alert switches when no wallet address is available, so the UI never implies a subscription was saved without an account-scoped preferences record.
