# Dashboard Alert Banner

This component surfaces near-due payment and collateral risk alerts at the top of the dashboard.

## Trigger thresholds

- `critical` when a payment is due in 1 day or less, or when the health factor reaches or falls below the critical threshold defined by `CRITICAL_HEALTH_FACTOR_THRESHOLD` in `lib/lending/health.ts`.
- `warning` when a payment is due in 3 days or less, or when the health factor reaches or falls below the healthy threshold defined by `HEALTHY_HEALTH_FACTOR_THRESHOLD` in `lib/lending/health.ts`.
- `info` when a payment is due in 7 days or less, or when the health factor reaches or falls below the same lending-health thresholds in `lib/lending/health.ts` for the banner’s health-based severity logic.

## Behavior

- The banner is dismissible and persists dismissal in `localStorage`.
- The banner uses a non-color-only design: icon, bold severity label, and concise text.
- The banner is rendered with an accessible `role="region"` and `aria-live` announcements.
