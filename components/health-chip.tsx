"use client";

import Link from "next/link";
import { useState } from "react";
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

function HealthSettings({
  thresholds,
  onSave,
  notifications,
}: {
  thresholds: Thresholds;
  onSave: HealthChipProps["onSaveThresholds"];
  notifications: HealthChipProps["notifications"];
}) {
  const [warning, setWarning] = useState(String(thresholds.warning));
  const [danger, setDanger] = useState(String(thresholds.danger));
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    const error = onSave({ warning: Number(warning), danger: Number(danger) });
    setMessage(error ?? "Saved.");
  }

  return (
    <details className="relative">
      <summary
        aria-label="Health alert settings"
        className="cursor-pointer list-none rounded-full border border-slate-400 px-2 py-1 text-xs"
      >
        ⚙
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-64 space-y-3 rounded-lg border border-slate-600 bg-slate-900 p-3 text-xs text-slate-100 shadow-lg">
        <label className="block">
          Warning below
          <input
            type="number"
            step="0.05"
            value={warning}
            onChange={(e) => setWarning(e.target.value)}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
          />
        </label>
        <label className="block">
          Danger below
          <input
            type="number"
            step="0.05"
            value={danger}
            onChange={(e) => setDanger(e.target.value)}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
          />
        </label>
        <button
          type="button"
          onClick={save}
          className="rounded bg-slate-700 px-2 py-1"
        >
          Save thresholds
        </button>
        {message && (
          <p role="status" className="text-slate-300">
            {message}
          </p>
        )}

        {notifications.permission === "unsupported" && (
          <p>Browser notifications are not supported here.</p>
        )}
        {notifications.permission === "denied" && (
          <p>
            Notifications are blocked in your browser settings, so alerts are
            unavailable.
          </p>
        )}
        {(notifications.permission === "default" ||
          notifications.permission === "granted") && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifications.enabled}
              onChange={() =>
                notifications.enabled
                  ? notifications.disable()
                  : notifications.enable()
              }
            />
            Notify me when my health factor gets worse
          </label>
        )}
      </div>
    </details>
  );
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