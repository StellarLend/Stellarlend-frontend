export type RateChartLabels = {
  eyebrow: string;
  title: string;
  subtitle: string;
  chartAriaLabel: string;
  sparklineAriaLabel: string;
  inactiveBannerTitle: string;
  inactiveBannerBody: string;
  demoBadge: string;
  liveBadge: string;
  currentUtilization: string;
  appliedRate: string;
  targetRate: string;
  kink: string;
  floorCeiling: string;
  surchargeBand: string;
  surchargeDisabled: string;
  lastUpdateLedger: string;
  elapsedLedgers: string;
  summaryActive: string;
  summaryInactive: string;
  legendCurve: string;
  legendCurrentUtil: string;
  legendAppliedRate: string;
  legendTargetRate: string;
  axisUtilization: string;
  axisBorrowRate: string;
  historyTitle: string;
  historySubtitle: string;
  historyEmptyTitle: string;
  historyEmptyBody: string;
  historyLedgerRange: string;
  historyLatestSample: string;
  tableToggle: string;
  curveTableCaption: string;
  colUtilization: string;
  colUtilizationBps: string;
  colBorrowApr: string;
  colBorrowBps: string;
  colNote: string;
  markerKink: string;
  markerCurrent: string;
  markerSurcharge: string;
  historyTableCaption: string;
  colLedger: string;
};

export const defaultRateChartLabels: RateChartLabels = {
  eyebrow: "Interest-rate model",
  title: "Two-slope borrow rate curve",
  subtitle:
    "Live parameters from get_rate_params, current utilization and smoothed rate from get_rate_model_diagnostics, and recent utilization samples from get_utilization_history.",
  chartAriaLabel: "Two-slope borrow rate curve chart",
  sparklineAriaLabel: "Protocol utilization history sparkline",
  inactiveBannerTitle: "Rate model inactive — default APR applies",
  inactiveBannerBody:
    "rate_model_active is false on the contract. Borrow positions accrue at the fixed default rate of 5.00% APR (500 bps) instead of the two-slope curve.",
  demoBadge: "Demo curve",
  liveBadge: "On-chain",
  currentUtilization: "Current utilization",
  appliedRate: "Applied rate (smoothed)",
  targetRate: "Target rate (raw)",
  kink: "Kink threshold",
  floorCeiling: "Floor / ceiling",
  surchargeBand: "Surcharge band",
  surchargeDisabled: "Disabled",
  lastUpdateLedger: "Last update ledger",
  elapsedLedgers: "{count} ledgers ago",
  summaryActive:
    "At {utilization} utilization, the target borrow rate is {targetRate} ({targetBps} bps) and the applied smoothed rate is {appliedRate} ({appliedBps} bps). The kink is at {kink} utilization.",
  summaryInactive:
    "The dynamic rate model is currently inactive. The protocol applies the default borrow rate of {defaultRate} ({defaultBps} bps) regardless of utilization ({utilization}).",
  legendCurve: "Borrow rate curve",
  legendCurrentUtil: "Current utilization",
  legendAppliedRate: "Applied rate",
  legendTargetRate: "Target rate",
  axisUtilization: "Utilization (%)",
  axisBorrowRate: "Borrow APR (%)",
  historyTitle: "Utilization history",
  historySubtitle: "Newest-first ring buffer (up to 256 ledger samples)",
  historyEmptyTitle: "No utilization history recorded yet",
  historyEmptyBody:
    "The contract returns an empty ring buffer until a borrow-rate update writes the first utilization sample on-chain.",
  historyLedgerRange: "Ledger {oldest} to {newest}",
  historyLatestSample: "Latest sample: {utilization} at ledger {ledger}",
  tableToggle: "Accessible data tables",
  curveTableCaption: "Sampled borrow-rate curve points",
  colUtilization: "Utilization",
  colUtilizationBps: "Utilization (bps)",
  colBorrowApr: "Borrow APR",
  colBorrowBps: "Borrow rate (bps)",
  colNote: "Marker",
  markerKink: "Kink",
  markerCurrent: "Current",
  markerSurcharge: "Surcharge kink",
  historyTableCaption: "Utilization history samples",
  colLedger: "Ledger",
};
