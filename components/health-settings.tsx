"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Thresholds } from "@/lib/health";
import type { NotificationPermissionState } from "@/hooks/use-health-monitor";

export type HealthSettingsProps = {
  thresholds: Thresholds;
  onSave: (next: Thresholds) => string | null;
  notifications: {
    permission: NotificationPermissionState;
    enabled: boolean;
    enable: () => void;
    disable: () => void;
  };
};

export function HealthSettings({
  thresholds,
  onSave,
  notifications,
}: HealthSettingsProps) {
  const t = useTranslations("market.healthStatus");
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [warning, setWarning] = useState(String(thresholds.warning));
  const [danger, setDanger] = useState(String(thresholds.danger));
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    setWarning(String(thresholds.warning));
    setDanger(String(thresholds.danger));
  }, [thresholds.warning, thresholds.danger]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      if (!next) {
        triggerRef.current?.focus();
      }
      return next;
    });
  }

  function closePopover() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function save() {
    const error = onSave({ warning: Number(warning), danger: Number(danger) });
    if (error) {
      setFeedback({ text: error, isError: true });
    } else {
      setFeedback({ text: t("saved"), isError: false });
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("settingsLabel")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popoverId}
        onClick={toggleOpen}
        className="cursor-pointer rounded-full border border-slate-400 px-2 py-1 text-xs"
      >
        {"⚙"}
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={t("settingsTitle")}
          className="absolute right-0 top-full z-50 mt-2 w-64 space-y-3 rounded-lg border border-slate-600 bg-slate-900 p-3 text-xs text-slate-100 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t("settingsTitle")}</span>
            <button
              type="button"
              onClick={closePopover}
              aria-label={t("close")}
              className="rounded px-1.5 py-0.5 text-slate-400 hover:text-slate-100"
            >
              {"×"}
            </button>
          </div>

          <label className="block">
            {t("warningBelow")}
            <input
              ref={firstInputRef}
              type="number"
              step="0.05"
              value={warning}
              onChange={(e) => setWarning(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
            />
          </label>

          <label className="block">
            {t("dangerBelow")}
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
            className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
          >
            {t("saveThresholds")}
          </button>

          {feedback && (
            <p
              role={feedback.isError ? "alert" : "status"}
              className={feedback.isError ? "text-amber-400" : "text-slate-300"}
            >
              {feedback.text}
            </p>
          )}

          {notifications.permission === "unsupported" && (
            <p className="text-slate-400">{t("notificationsUnsupported")}</p>
          )}

          {notifications.permission === "denied" && (
            <p className="text-slate-400">{t("notificationsDenied")}</p>
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
              <span>{t("notifyToggle")}</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
