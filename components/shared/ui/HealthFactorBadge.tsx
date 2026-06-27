import React from "react";
import {
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import {
  colorNeutral,
  colorSemantic,
} from "@/constants/design-tokens";
import { cn } from "@/lib/utils/cn";
import { getHealthBand, getHealthLabel, type HealthBand } from "@/lib/lending/health";

export interface HealthFactorBadgeProps {
  healthFactor: number;
  className?: string;
}

type BadgeConfig = {
  label: string;
  srPrefix: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const HEALTH_FACTOR_BADGE_CONFIG: Record<HealthBand, BadgeConfig> = {
  healthy: {
    label: "Healthy",
    srPrefix: "Projected health",
    backgroundColor: colorSemantic.successLight,
    borderColor: colorSemantic.success,
    textColor: colorSemantic.success,
    Icon: ShieldCheck,
  },
  "at-risk": {
    label: "At Risk",
    srPrefix: "Projected health",
    backgroundColor: colorSemantic.warningLight,
    borderColor: colorSemantic.warning,
    textColor: "#9A6700",
    Icon: ShieldAlert,
  },
  critical: {
    label: "Critical",
    srPrefix: "Projected health",
    backgroundColor: colorSemantic.errorLight,
    borderColor: colorSemantic.error,
    textColor: colorSemantic.error,
    Icon: ShieldX,
  },
  cleared: {
    label: "Debt cleared",
    srPrefix: "Projected health",
    backgroundColor: colorNeutral[100],
    borderColor: colorNeutral[400],
    textColor: colorNeutral[800],
    Icon: CheckCircle2,
  },
};

export default function HealthFactorBadge({
  healthFactor,
  className,
}: HealthFactorBadgeProps) {
  const band = getHealthBand(healthFactor);
  const config = HEALTH_FACTOR_BADGE_CONFIG[band];
  const Icon = config.Icon;
  const visibleLabel = getHealthLabel(healthFactor);
  const ariaLabel = `${config.srPrefix}: ${visibleLabel}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      data-health-band={band}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      style={{
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor,
        color: config.textColor,
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{visibleLabel}</span>
    </span>
  );
}
