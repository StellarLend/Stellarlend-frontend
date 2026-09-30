/**
 * components/index.ts — Failure-path & boundary coverage
 *
 * Invariants enforced here:
 *  1. Every symbol advertised by the barrel is *actually* defined (not
 *     undefined/null), so a mis-named re-export is caught immediately.
 *  2. Named exports that share an identifier do NOT silently shadow each
 *     other across sub-barrels — each resolved value is unique (referential
 *     identity check) or maps to the correct originating module.
 *  3. Type-only exports compile without error (static, not runtime).
 *  4. Newly commented-out sub-barrels (e.g. marketing) do NOT leak any
 *     symbol into the public surface.
 *  5. The barrel is idempotent: re-importing it multiple times yields the
 *     same object references (ES module cache is stable).
 *  6. `transactionStatusToVariant` handles every documented status key and
 *     returns "neutral" for any unknown / boundary string.
 *  7. `formatWithCommas` (re-exported via the AmountInput barrel) handles
 *     integer, float, boundary (0, precision edge-cases).
 *
 * This file deliberately avoids rendering React components (no jsdom needed)
 * so it runs in the fast "server-unit" Vitest project environment.
 */

import { describe, it, expect } from 'vitest';

// 1. Import everything from the barrel
import * as ComponentsBarrel from '@/components/index';

// 2. Import sub-barrels directly for identity checks
import * as SharedUI from '@/components/shared/ui';
import * as SharedLayout from '@/components/shared/layout';
import * as SharedCommon from '@/components/shared/common';
import * as LendingComponents from '@/components/features/lending/components';
import * as DashboardComponents from '@/components/features/dashboard/components';
import * as AccountComponents from '@/components/features/account/components';
import * as OrganismsBarrel from '@/components/organisms';

// 3. Direct imports for pure-function boundary tests
import {
  transactionStatusToVariant,
} from '@/components/shared/ui/StatusBadge';
import {
  formatWithCommas,
} from '@/components/shared/ui/AmountInput';

// ==========================================================================
// §1 — Barrel completeness: every exported name is defined
// ==========================================================================
describe('components/index.ts — barrel completeness', () => {
  it('exports a non-empty object', () => {
    expect(ComponentsBarrel).toBeDefined();
    expect(typeof ComponentsBarrel).toBe('object');
    const keys = Object.keys(ComponentsBarrel);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('every exported binding is not undefined', () => {
    for (const [key, value] of Object.entries(ComponentsBarrel)) {
      expect(value, `Export "${key}" must not be undefined`).not.toBeUndefined();
    }
  });

  it('every exported binding is not null', () => {
    for (const [key, value] of Object.entries(ComponentsBarrel)) {
      expect(value, `Export "${key}" must not be null`).not.toBeNull();
    }
  });
});

// ==========================================================================
// §2 — Referential identity: barrel exports == originating module exports
// ==========================================================================
describe('components/index.ts — referential identity', () => {
  // shared/ui
  it('re-exports Button from shared/ui unchanged', () => {
    expect(ComponentsBarrel.Button).toBe(SharedUI.Button);
  });

  it('re-exports HealthFactorBadge from shared/ui unchanged', () => {
    expect(ComponentsBarrel.HealthFactorBadge).toBe(SharedUI.HealthFactorBadge);
  });

  it('re-exports StatusBadge from shared/ui unchanged', () => {
    expect(ComponentsBarrel.StatusBadge).toBe(SharedUI.StatusBadge);
  });

  it('re-exports transactionStatusToVariant from shared/ui unchanged', () => {
    expect(ComponentsBarrel.transactionStatusToVariant).toBe(
      SharedUI.transactionStatusToVariant,
    );
  });

  it('re-exports AmountInput from shared/ui unchanged', () => {
    expect(ComponentsBarrel.AmountInput).toBe(SharedUI.AmountInput);
  });

  it('re-exports formatWithCommas from shared/ui unchanged', () => {
    expect(ComponentsBarrel.formatWithCommas).toBe(SharedUI.formatWithCommas);
  });

  // shared/layout
  it('re-exports Navbar from shared/layout unchanged', () => {
    expect(ComponentsBarrel.Navbar).toBe(SharedLayout.Navbar);
  });

  it('re-exports Sidebar from shared/layout unchanged', () => {
    expect(ComponentsBarrel.Sidebar).toBe(SharedLayout.Sidebar);
  });

  it('re-exports TopNav from shared/layout unchanged', () => {
    expect(ComponentsBarrel.TopNav).toBe(SharedLayout.TopNav);
  });

  it('re-exports NavLink from shared/layout unchanged', () => {
    expect(ComponentsBarrel.NavLink).toBe(SharedLayout.NavLink);
  });

  it('re-exports NavigationMenu from shared/layout unchanged', () => {
    expect(ComponentsBarrel.NavigationMenu).toBe(SharedLayout.NavigationMenu);
  });

  it('re-exports DashboardLayout from shared/layout unchanged', () => {
    expect(ComponentsBarrel.DashboardLayout).toBe(SharedLayout.DashboardLayout);
  });

  it('re-exports SideNav from shared/layout unchanged', () => {
    expect(ComponentsBarrel.SideNav).toBe(SharedLayout.SideNav);
  });

  it('re-exports Breadcrumbs from shared/layout unchanged', () => {
    expect(ComponentsBarrel.Breadcrumbs).toBe(SharedLayout.Breadcrumbs);
  });

  it('re-exports AccountMenu from shared/layout unchanged', () => {
    expect(ComponentsBarrel.AccountMenu).toBe(SharedLayout.AccountMenu);
  });

  // shared/common
  it('re-exports RecentTransactions from shared/common unchanged', () => {
    expect(ComponentsBarrel.RecentTransactions).toBe(
      SharedCommon.RecentTransactions,
    );
  });

  it('re-exports PageHeader from shared/common unchanged', () => {
    expect(ComponentsBarrel.PageHeader).toBe(SharedCommon.PageHeader);
  });

  it('re-exports AlertBanner from shared/common unchanged', () => {
    expect(ComponentsBarrel.AlertBanner).toBe(SharedCommon.AlertBanner);
  });

  it('re-exports Toast from shared/common unchanged', () => {
    expect(ComponentsBarrel.Toast).toBe(SharedCommon.Toast);
  });

  it('re-exports ToastProvider from shared/common unchanged', () => {
    expect(ComponentsBarrel.ToastProvider).toBe(SharedCommon.ToastProvider);
  });

  it('re-exports useToast from shared/common unchanged', () => {
    expect(ComponentsBarrel.useToast).toBe(SharedCommon.useToast);
  });

  it('re-exports NotificationToastBridge from shared/common unchanged', () => {
    expect(ComponentsBarrel.NotificationToastBridge).toBe(
      SharedCommon.NotificationToastBridge,
    );
  });

  it('re-exports FeatureGate from shared/common unchanged', () => {
    expect(ComponentsBarrel.FeatureGate).toBe(SharedCommon.FeatureGate);
  });

  it('re-exports PriceTicker from shared/common unchanged', () => {
    expect(ComponentsBarrel.PriceTicker).toBe(SharedCommon.PriceTicker);
  });

  // features/lending
  it('re-exports LendingForm from features/lending unchanged', () => {
    expect(ComponentsBarrel.LendingForm).toBe(LendingComponents.LendingForm);
  });

  it('re-exports BorrowingForm from features/lending unchanged', () => {
    expect(ComponentsBarrel.BorrowingForm).toBe(LendingComponents.BorrowingForm);
  });

  it('re-exports InterestCalculator from features/lending unchanged', () => {
    expect(ComponentsBarrel.InterestCalculator).toBe(
      LendingComponents.InterestCalculator,
    );
  });

  it('re-exports TransactionSummary from features/lending unchanged', () => {
    expect(ComponentsBarrel.TransactionSummary).toBe(
      LendingComponents.TransactionSummary,
    );
  });

  it('re-exports ConfirmModal from features/lending unchanged', () => {
    expect(ComponentsBarrel.ConfirmModal).toBe(LendingComponents.ConfirmModal);
  });

  it('re-exports RepayForm from features/lending unchanged', () => {
    expect(ComponentsBarrel.RepayForm).toBe(LendingComponents.RepayForm);
  });

  it('re-exports TabSelector from features/lending unchanged', () => {
    expect(ComponentsBarrel.TabSelector).toBe(LendingComponents.TabSelector);
  });

  it('re-exports WithdrawForm from features/lending unchanged', () => {
    expect(ComponentsBarrel.WithdrawForm).toBe(LendingComponents.WithdrawForm);
  });

  it('re-exports MarketsTable from features/lending unchanged', () => {
    expect(ComponentsBarrel.MarketsTable).toBe(LendingComponents.MarketsTable);
  });

  // features/dashboard
  it('re-exports MetricsCards from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.MetricsCards).toBe(DashboardComponents.MetricsCards);
  });

  it('re-exports SearchResults from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.SearchResults).toBe(DashboardComponents.SearchResults);
  });

  it('re-exports LiquidationsPanel from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.LiquidationsPanel).toBe(
      DashboardComponents.LiquidationsPanel,
    );
  });

  it('re-exports PositionSummary from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.PositionSummary).toBe(
      DashboardComponents.PositionSummary,
    );
  });

  it('re-exports NextPaymentDue from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.NextPaymentDue).toBe(
      DashboardComponents.NextPaymentDue,
    );
  });

  it('re-exports TransactionDetail from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.TransactionDetail).toBe(
      DashboardComponents.TransactionDetail,
    );
  });

  it('re-exports TransactionReceipt from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.TransactionReceipt).toBe(
      DashboardComponents.TransactionReceipt,
    );
  });

  it('re-exports NetWorthTrend from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.NetWorthTrend).toBe(
      DashboardComponents.NetWorthTrend,
    );
  });

  it('re-exports FilterPresets from features/dashboard unchanged', () => {
    expect(ComponentsBarrel.FilterPresets).toBe(
      DashboardComponents.FilterPresets,
    );
  });

  // features/account
  it('re-exports ProfileForm from features/account unchanged', () => {
    expect(ComponentsBarrel.ProfileForm).toBe(AccountComponents.ProfileForm);
  });

  it('re-exports DisplayProfileForm from features/account unchanged', () => {
    expect(ComponentsBarrel.DisplayProfileForm).toBe(
      AccountComponents.DisplayProfileForm,
    );
  });

  it('re-exports DataExportButton from features/account unchanged', () => {
    expect(ComponentsBarrel.DataExportButton).toBe(
      AccountComponents.DataExportButton,
    );
  });

  it('re-exports PreferencesForm from features/account unchanged', () => {
    expect(ComponentsBarrel.PreferencesForm).toBe(
      AccountComponents.PreferencesForm,
    );
  });

  it('re-exports NotificationPreferences from features/account unchanged', () => {
    expect(ComponentsBarrel.NotificationPreferences).toBe(
      AccountComponents.NotificationPreferences,
    );
  });

  it('re-exports AccountDeletion from features/account unchanged', () => {
    expect(ComponentsBarrel.AccountDeletion).toBe(
      AccountComponents.AccountDeletion,
    );
  });

  it('re-exports AccountDeletionUndo from features/account unchanged', () => {
    expect(ComponentsBarrel.AccountDeletionUndo).toBe(
      AccountComponents.AccountDeletionUndo,
    );
  });

  it('re-exports SessionsList from features/account unchanged', () => {
    expect(ComponentsBarrel.SessionsList).toBe(AccountComponents.SessionsList);
  });

  it('re-exports AccountDeletionPanel from features/account unchanged', () => {
    expect(ComponentsBarrel.AccountDeletionPanel).toBe(
      AccountComponents.AccountDeletionPanel,
    );
  });

  // organisms
  it('re-exports Header from organisms unchanged', () => {
    expect(ComponentsBarrel.Header).toBe(OrganismsBarrel.Header);
  });
});

// ==========================================================================
// §3 — Commented-out sub-barrels must NOT leak into the public surface
// ==========================================================================
describe('components/index.ts — suppressed sub-barrels', () => {
  it('does not expose a "marketing" namespace key at the top level', () => {
    // The marketing barrel is commented out; no leakage expected.
    expect(
      Object.prototype.hasOwnProperty.call(ComponentsBarrel, 'marketing'),
    ).toBe(false);
  });
});

// ==========================================================================
// §4 — ES-module cache idempotency
// ==========================================================================
describe('components/index.ts — module cache stability', () => {
  it('importing the barrel twice yields the same Button reference', async () => {
    const first = await import('@/components/index');
    const second = await import('@/components/index');
    expect(first.Button).toBe(second.Button);
  });

  it('importing the barrel twice yields the same StatusBadge reference', async () => {
    const first = await import('@/components/index');
    const second = await import('@/components/index');
    expect(first.StatusBadge).toBe(second.StatusBadge);
  });
});

// ==========================================================================
// §5 — transactionStatusToVariant: success / boundary / failure paths
// ==========================================================================
describe('transactionStatusToVariant — success paths', () => {
  const successStatuses = [
    'Completed', 'completed', 'Success', 'success', 'SUCCESS',
  ];
  for (const status of successStatuses) {
    it(`maps "${status}" to "success"`, () => {
      expect(transactionStatusToVariant(status)).toBe('success');
    });
  }

  const pendingStatuses = [
    'Processing', 'processing', 'Pending', 'pending', 'PENDING',
    'Warning', 'warning', 'RATE_LIMITED', 'rate_limited',
  ];
  for (const status of pendingStatuses) {
    it(`maps "${status}" to "pending"`, () => {
      expect(transactionStatusToVariant(status)).toBe('pending');
    });
  }

  const failedStatuses = [
    'Failed', 'failed', 'FAILED', 'Error', 'error',
    'Cancelled', 'cancelled', 'Expired', 'expired',
    'Rejected', 'rejected', 'NOT_FOUND', 'not_found',
  ];
  for (const status of failedStatuses) {
    it(`maps "${status}" to "failed"`, () => {
      expect(transactionStatusToVariant(status)).toBe('failed');
    });
  }
});

describe('transactionStatusToVariant — boundary & failure paths', () => {
  it('returns "neutral" for an empty string', () => {
    expect(transactionStatusToVariant('')).toBe('neutral');
  });

  it('returns "neutral" for a completely unknown status', () => {
    expect(transactionStatusToVariant('UNKNOWN_STATUS_XYZ')).toBe('neutral');
  });

  it('returns "neutral" for a whitespace-only status', () => {
    expect(transactionStatusToVariant('   ')).toBe('neutral');
  });

  it('returns "neutral" for a numeric-string status', () => {
    expect(transactionStatusToVariant('404')).toBe('neutral');
  });

  it('returns "neutral" for a mixed-case unknown string', () => {
    expect(transactionStatusToVariant('CoMpLeTed')).toBe('neutral');
  });

  it('is deterministic — two calls with the same input return the same value', () => {
    const a = transactionStatusToVariant('pending');
    const b = transactionStatusToVariant('pending');
    expect(a).toBe(b);
  });

  it('is deterministic across unknown inputs', () => {
    const a = transactionStatusToVariant('anything_weird');
    const b = transactionStatusToVariant('anything_weird');
    expect(a).toBe(b);
  });
});

// ==========================================================================
// §6 — formatWithCommas: success / precision / boundary paths
// ==========================================================================
describe('formatWithCommas — success paths', () => {
  it('formats an integer without commas for small values', () => {
    expect(formatWithCommas(123)).toBe('123');
  });

  it('adds thousands separator for values >= 1000', () => {
    expect(formatWithCommas(1000)).toBe('1,000');
  });

  it('adds thousands separator for values >= 1000000', () => {
    expect(formatWithCommas(1000000)).toBe('1,000,000');
  });

  it('preserves existing decimal places when decimalPlaces is undefined', () => {
    expect(formatWithCommas(1234.56)).toBe('1,234.56');
  });

  it('pads to the requested decimal places', () => {
    expect(formatWithCommas(1234, 2)).toBe('1,234.00');
  });

  it('pads to 4 decimal places', () => {
    expect(formatWithCommas(1, 4)).toBe('1.0000');
  });

  it('returns the integer part only when decimalPlaces is 0', () => {
    expect(formatWithCommas(1234.99, 0)).toBe('1,234');
  });
});

describe('formatWithCommas — boundary paths', () => {
  it('handles 0 correctly (no commas, no decimal without precision arg)', () => {
    expect(formatWithCommas(0)).toBe('0');
  });

  it('handles 0 with decimalPlaces = 2', () => {
    expect(formatWithCommas(0, 2)).toBe('0.00');
  });

  it('handles a value with no decimal component and decimalPlaces = 3', () => {
    expect(formatWithCommas(999, 3)).toBe('999.000');
  });

  it('handles exact thousand boundary (999)', () => {
    expect(formatWithCommas(999)).toBe('999');
  });

  it('handles exactly 1000 (first value to get a comma)', () => {
    expect(formatWithCommas(1000)).toBe('1,000');
  });

  it('is deterministic — two calls with the same args return identical strings', () => {
    const a = formatWithCommas(1234567.89);
    const b = formatWithCommas(1234567.89);
    expect(a).toBe(b);
  });
});

// ==========================================================================
// §7 — Exported values are the correct type (function / object checks)
// ==========================================================================
describe('components/index.ts — exported value types', () => {
  it('transactionStatusToVariant is a function', () => {
    expect(typeof ComponentsBarrel.transactionStatusToVariant).toBe('function');
  });

  it('formatWithCommas is a function', () => {
    expect(typeof ComponentsBarrel.formatWithCommas).toBe('function');
  });

  it('useToast is a function (hook)', () => {
    expect(typeof ComponentsBarrel.useToast).toBe('function');
  });

  it('StatusBadge is a function (React component)', () => {
    expect(typeof ComponentsBarrel.StatusBadge).toBe('function');
  });

  it('Button is a function (React component)', () => {
    expect(typeof ComponentsBarrel.Button).toBe('function');
  });

  it('FeatureGate is a function (React component)', () => {
    expect(typeof ComponentsBarrel.FeatureGate).toBe('function');
  });

  it('AmountInput is defined (React.forwardRef component)', () => {
    expect(ComponentsBarrel.AmountInput).toBeDefined();
    expect(typeof ComponentsBarrel.AmountInput).not.toBe('undefined');
  });

  it('Header is a function (React component)', () => {
    expect(typeof ComponentsBarrel.Header).toBe('function');
  });
});

// ==========================================================================
// §8 — No name-collision: distinct exports resolve to distinct values
//       (protects against wildcard merge shadowing)
// ==========================================================================
describe('components/index.ts — no silent shadowing between sub-barrels', () => {
  it('Button and Header are different values', () => {
    expect(ComponentsBarrel.Button).not.toBe(ComponentsBarrel.Header);
  });

  it('StatusBadge and HealthFactorBadge are different values', () => {
    expect(ComponentsBarrel.StatusBadge).not.toBe(
      ComponentsBarrel.HealthFactorBadge,
    );
  });

  it('LendingForm and BorrowingForm are different values', () => {
    expect(ComponentsBarrel.LendingForm).not.toBe(ComponentsBarrel.BorrowingForm);
  });

  it('Toast and ToastProvider are different values', () => {
    expect(ComponentsBarrel.Toast).not.toBe(ComponentsBarrel.ToastProvider);
  });

  it('AccountDeletion and AccountDeletionPanel are different values', () => {
    expect(ComponentsBarrel.AccountDeletion).not.toBe(
      ComponentsBarrel.AccountDeletionPanel,
    );
  });

  it('TransactionSummary (lending) and TransactionDetail (dashboard) are different values', () => {
    expect(ComponentsBarrel.TransactionSummary).not.toBe(
      ComponentsBarrel.TransactionDetail,
    );
  });
});
