"use client";

import Link from "next/link";
import {
  formatHealthFactor,
  type HealthFactor,
  type HealthLevel,
  type Thresholds,
} from "@/lib/health";
import type {
  MonitorStatus,
  NotificationPermissionState,
} from "@/hooks/use-health-monitor";
import { HealthSettings } from "./health-settings";

const LEVEL_LABEL: Record<HealthLevel, string> = {
  safe: "Safe",
  warning: "Warning",
  danger: "Danger",
  liquidatable: "Liquidatable",
};

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

function chipText(
  health: HealthFactor | null,
  level: HealthLevel | null,
  status: MonitorStatus,
): string {
  if (!health || !level) {
    return status === "error" ? "Health: unavailable" : "Health: loading";
  }
  if (health.status !== "ok") return formatHealthFactor(health);
  return `HF ${formatHealthFactor(health)} · ${LEVEL_LABEL[level]}`;
}

export function HealthChip({
  health,
  level,
  status,
  thresholds,
  onSaveThresholds,
  notifications,
}: HealthChipProps) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/markets"
        data-testid="health-chip"
        data-level={level ?? "unknown"}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${LEVEL_STYLE[level ?? "unknown"]}`}
      >
        {chipText(health, level, status)}
      </Link>
      <HealthSettings
        thresholds={thresholds}
        onSave={onSaveThresholds}
        notifications={notifications}
      />
    </div>
  );
}