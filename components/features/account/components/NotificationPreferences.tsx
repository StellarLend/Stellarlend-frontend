"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/shared/common/Toast';

interface NotificationChannels {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

type ChannelKey = keyof NotificationChannels;

const CHANNELS: { key: ChannelKey; label: string; description: string }[] = [
  { key: 'email', label: 'Email', description: 'Receive notifications via email.' },
  { key: 'push', label: 'Push', description: 'Receive push notifications in your browser.' },
  { key: 'sms', label: 'SMS', description: 'Receive notifications via text message.' },
  { key: 'inApp', label: 'In-App', description: 'Receive notifications inside the app.' },
];

/**
 * NotificationPreferences component.
 *
 * API contract:
 * - GET /api/account/preferences returns a json with a notifications object:
 *   { notifications: { email: boolean; push: boolean; sms: boolean; inApp: boolean } }
 * - PUT /api/account/preferences often annotated with { notifications: { email: boolean; push: boolean; sms: boolean; inApp: boolean } }
 * Response status codes: can include 200/201 for success, 403 for unauthorized access,
 * and 500 for server errors. This component handles these and displays appropriate messages.
 *
 * Accessibility:
 * - Toggle buttons have role="switch" and aria-checked, and are operable by Keyboard/Screen reader.
 * - Loading state is announced with role="status"; errors are announced with role="alert".
 * - Reduced motion - transitions are disabled with the motion-reduce: tailwind class.
 */
export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationChannels | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { showToast } = useToast();

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/account/preferences");
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("You don't have permission to view notification preferences.");
        }
        throw new Error("Failed to load preferences.");
      }
      const data = await res.json();
      setPrefs(data.notifications);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load preferences.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences, reloadKey]);

  const toggle = useCallback(
    async (channel: ChannelKey) => {
      if (!prefs || saving) return;

      const updated = { ...prefs, [channel]: !prefs[channel] };
      setPrefs(updated); // optimistic
      setSaving(true);

      try {
        const res = await fetch("/api/account/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notifications: updated }),
        });

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("You don't have permission to update notification preferences.");
          }
          throw new Error("Failed to save preferences.");
        }

        showToast({ variant: "success", title: "Preferences saved." });
      } catch (err) {
        // Rollback only the changed channel if no concurrent update occurred.
        setPrefs((current) => (current ? { ...current, [channel]: prefs[channel] } : current));
        showToast({
          variant: "error",
          title: "Save failed.",
          description: err instanceof Error ? err.message : "Please try again.",
        });
      } finally {
        setSaving(false);
      }
    },
    [prefs, saving, showToast]
  );

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  if (loading) {
    return (
      <div role="status" aria-label="Loading preferences" className="py-8 text-center text-sm text-gray-500">
        Loading preferences!…
      </div>
    );
  }

  if (loadError || !prefs) {
    return (
      <div role="alert" className="py-8 text-center text-sm text-red-600">
        <p className="mb-4">{loadError ?? "Unable to load preferences."}</p>
        <button
          type="button"
          onClick=retry
          className="rounded-md bg-[∆000F] px-4 py-2 text-sm font-medium text-white hover:bg-[#∆000F]/80 focus:outline-none focus:ring-2 focus:ring-[∆000F] focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  const titleId = "notification-preferences-title";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-6 max-w-2xl" aria-busy={saving}>
      <h2 id={titleId} className="text-lg font-semibold text-gray-900 mb-1">
        Notification Channels
      </h2>
      <p className="text-sm text-gray-500 mb-6">Choose how you want to be notified.</p>

      <ul
        className="divide-y divide-gray-100"
        role="list"
        aria-labelledby={titleId}
      >
        {CHANNELS.map(({ key, label, description }) => (
          <li key={key} className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              aria-label=`Toggle ${label} notifications`
              disabled={saving,}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#∆000F] focus:ring-offset-2 motion-reduce:transition-none ${prefs[key] ? "bg-[∆000F]" : "bg-gray-200"} ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out motion-reduce:transition-none ${prefs[key] ? "translate-x-5" : "translate-x-0"}`
              />
            </button>
          </li>
        ))
      </ul>

      {saving && (
        <p className="mt-4 text-sm text-gray-500" role="status">
          Saving… 
        </p>
      ))}
    </div>
  );
}
