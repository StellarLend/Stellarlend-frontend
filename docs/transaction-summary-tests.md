# TransactionSummary RTL Coverage

Component: [`components/features/lending/components/TransactionSummary.tsx`](../components/features/lending/components/TransactionSummary.tsx)  
Tests: [`components/features/lending/components/TransactionSummary.test.tsx`](../components/features/lending/components/TransactionSummary.test.tsx)

GrantFox issue **#672** — RTL coverage for supply/borrow (and related) breakdown rendering. **No production behaviour change.**

## Variants covered

| Flow (`type`) | What the tests assert |
|---|---|
| **lend** (supply) | `Expected Returns` section, daily/total earnings labels, `LEND` badge; loading skeleton when `calculation` is `null` |
| **borrow** | `Repayment Details`, total interest, `BORROW` badge; loading skeleton when `calculation` is `null` |
| **repay** | `REPAY` badge, “Repaying” label, repayment breakdown rows (amount repaid, remaining debt, new health factor); full-repay “Debt cleared” paths (`remainingDebt = 0`, health factor Infinity); zero-amount empty state |
| **withdraw** | `WITHDRAW` badge, “Withdrawing” label, withdrawal breakdown (incl. remaining supply), health factor row visibility when debt present/absent; zero-amount empty state |

## Edge cases

- **Zero amount** — empty state for repay and withdraw (amount `0`).
- **Missing calculation** — loading skeleton **only** for lend/borrow; repay/withdraw still render their breakdowns with `calculation={null}`.
- **Full repay** — remaining debt and health factor surface “Debt cleared” instead of numeric leftovers.
- **Formatting** — amounts and health factors go through the component’s existing format helpers (`lib/utils/format` / inline display); tests assert visible labels and key numeric strings rather than re-implementing format logic.

## How to run

```bash
npx vitest run components/features/lending/components/TransactionSummary.test.tsx
```

## Out of scope

- Changing breakdown math or labels in production code.
- Visual/screenshot regression (Storybook stories may exist separately).
