# Liquidation Alert Subscriptions

`LiquidationsPanel` includes a per-row alert toggle so users can opt into
liquidation-warning notifications for specific at-risk positions.

## Preference flow

The panel loads current subscriptions from:

```text
GET /api/account/notification-preferences?eventType=liquidation_warning
```

Each row derives a stable position subscription id from the borrowed asset,
collateral asset, borrowed amount, collateral amount, and row index. Toggling a
row persists through:

```text
PUT /api/account/notification-preferences
```

with a JSON body containing `eventType`, `positionId`, and `enabled`.

## UI behavior

- Toggles update optimistically so users get immediate feedback.
- Failed persistence rolls the toggle back and shows an inline alert.
- A pending toggle is disabled to avoid overlapping writes during rapid clicks.
- Empty liquidation-risk tables do not request alert preferences.

## Accessibility

Each toggle is rendered as a keyboard-operable switch with an accessible label
that identifies the borrowed and collateral assets for the row.
