"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  HealthFactor,
  HealthLevel,
  Thresholds,
} from "@/lib/health";
import type {
  MonitorStatus,
  NotificationPermissionState,
} from "@/hooks/use-health-monitor";
import { HealthSettings } from "./health-settings";

const LEVEL_STYLE: Record<HealthLevel | "unknown", string> = {
  safe: "border-emerald-500 text-emerald-600",
  warning: "border-amber-500 text-amber-600",
  danger: "border-orange-600 text-orange-600",
  liquidatable: "border-red-600 text-red-600",
  unknown: "border-slate-400 text-slate-500",
};

export type HealthChipProps = {
  health: HealthFactor | null;
  level: HealthLevel | null;
  status: MonitorStatus;
  thresholds: Thresholds;
  onSaveThresholds: (next: Thresholds) => string | null;
  notifications: {
    permission: NotificationPermissionState;
    enabled: boolean;
    enable: () => void;
    disable: () => void;
  };
};

export function HealthChip({
  health,
  level,
  status,
  thresholds,
  onSaveThresholds,
  notifications,
}: HealthChipProps) {
  const locale = useLocale();
  const t = useTranslations("market.healthStatus");

  const levelLabels: Record<HealthLevel, string> = {
    safe: t("levels.safe"),
    warning: t("levels.warning"),
    danger: t("levels.danger"),
    liquidatable: t("levels.liquidatable"),
  };

  function localizedValue(current: HealthFactor): string | null {
    if (
      current.status !== "ok" ||
      current.value === null ||
      !Number.isFinite(current.value)
    ) {
      return null;
    }
    const truncated = Math.trunc(current.value * 100) / 100;
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(truncated);
  }

  function describe(text: string, value: string, currentLevel: HealthLevel | null) {
    const levelName = currentLevel
      ? levelLabels[currentLevel]
      : t("unavailable");
    return {
      text,
      ariaLabel: t("ariaLabel", { value, level: levelName }),
      tooltip: t("tooltip", { value, level: levelName }),
    };
  }

  let display: { text: string; ariaLabel: string; tooltip: string };
  if (!health || !level) {
    const text = status === "error" ? t("error") : t("loading");
    display = { text, ariaLabel: text, tooltip: text };
  } else if (health.status === "no-debt") {
    const text = t("noDebt");
    display = describe(text, text, level);
  } else if (health.status === "very-safe") {
    const text = t("verySafe");
    display = describe(text, text, level);
  } else {
    const value = localizedValue(health);
    if (value === null) {
      const text = t("unavailable");
      display = describe(text, text, level);
    } else {
      display = describe(
        t("chip", { value, level: levelLabels[level] }),
        value,
        level,
      );
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/markets"
        data-testid="health-chip"
        data-level={level ?? "unknown"}
        aria-label={display.ariaLabel}
        title={display.tooltip}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${LEVEL_STYLE[level ?? "unknown"]}`}
      >
        {display.text}
      </Link>
      <HealthSettings
        thresholds={thresholds}
        onSave={onSaveThresholds}
        notifications={notifications}
      />
    </div>
  );
}
