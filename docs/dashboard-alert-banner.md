# Dashboard Alert Banner

This component surfaces near-due payment and collateral risk alerts at the top of the dashboard.

## Trigger thresholds

- `critical` when a payment is due in 1 day or less, or when the health factor drops to `1.15` or below.
- `warning` when a payment is due in 3 days or less, or when the health factor drops to `1.25` or below.
- `info` when a payment is due in 7 days or less, or when the health factor drops to `1.35` or below.

## Behavior

- The banner is dismissible and persists dismissal in `localStorage`.
- The banner uses a non-color-only design: icon, bold severity label, and concise text.
- The banner is rendered with an accessible `role="region"` and `aria-live` announcements.
