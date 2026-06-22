"use client";

import Link from "next/link";

import { AlertBanner } from "@/components/shared/common";
import type { AlertBannerSeverity } from "@/components/shared/common/AlertBanner";

export interface HealthFactorAlertProps {
  healthFactor?: number | null;
  repayHref?: string;
  collateralHref?: string;
}

type HealthBand = "healthy" | "at-risk" | "critical";

const getHealthBand = (healthFactor: number): HealthBand => {
  if (healthFactor >= 2) {
    return "healthy";
  }

  if (healthFactor >= 1) {
    return "at-risk";
  }

  return "critical";
};

const bandSeverity: Record<Exclude<HealthBand, "healthy">, AlertBannerSeverity> = {
  "at-risk": "warning",
  critical: "critical",
};

export default function HealthFactorAlert({
  healthFactor,
  repayHref = "/lending?tab=repay",
  collateralHref = "/lending?tab=borrow",
}: HealthFactorAlertProps) {
  if (typeof healthFactor !== "number" || !Number.isFinite(healthFactor)) {
    return null;
  }

  const band = getHealthBand(healthFactor);

  if (band === "healthy") {
    return null;
  }

  const isCritical = band === "critical";
  const formattedHealthFactor = healthFactor.toFixed(2);
  const severity = bandSeverity[band];

  return (
    <AlertBanner
      role="alert"
      severity={severity}
      dismissKey={`health-factor-alert-${band}`}
      title={isCritical ? "Liquidation risk is critical" : "Collateral health is weakening"}
      message={
        isCritical
          ? `Your health factor is ${formattedHealthFactor}x, below the 1.00x liquidation threshold. Repay debt or add collateral immediately.`
          : `Your health factor is ${formattedHealthFactor}x. It is below the 2.00x healthy range and approaching liquidation risk.`
      }
      actions={
        <>
          <Link className="rounded-full bg-white/80 px-4 py-2 text-slate-900 underline-offset-4 hover:underline" href={repayHref}>
            Repay debt
          </Link>
          <Link className="rounded-full bg-white/80 px-4 py-2 text-slate-900 underline-offset-4 hover:underline" href={collateralHref}>
            Add collateral
          </Link>
        </>
      }
    />
  );
}
