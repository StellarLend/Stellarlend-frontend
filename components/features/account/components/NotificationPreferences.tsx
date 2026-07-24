"use client";

import React, { useCallback, useEffect, useState } from "react";
import Toast from "@/components/shared/common/Toast";

interface NotificationChannels {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

interface Toast {
  variant: "success" | "error";
  title: string;
  description?: string;
}

const CHANNELS: { key: keyof NotificationChannels; label: string; description: string }[] = [
  { key: "email", label: "Email", description: "Receive notifications via email." },
  { key: "push", label: "Push", description: "Receive push notifications in your browser." },
  { key: "sms", label: "SMS", description: "Receive notifications via text message." },
  { key: "inApp", label: "In-App", description: "Receive notifications inside the app." },
];

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationChannels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch("/api/account/preferences")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load preferences.");
        const data = await res.json();
        setPrefs(data.notifications);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(
    async (channel: keyof NotificationChannels) => {
      if (!prefs) return;

      const updated = { ...prefs, [channel]: !prefs[channel] };
      setPrefs(updated); // optimistic

      try {
        const res = await fetch("/api/account/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notifications: updated }),
        });

        if (!res.ok) throw new Error("Failed to save preferences.");

        showToast({ variant: "success", title: "Preferences saved." });
      } catch (err) {
        setPrefs(prefs); // rollback
        showToast({
          variant: "error",
          title: "Save failed.",
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
    [prefs]
  );

  if (loading) {
    return (
      <div role="status" aria-label="Loading preferences" className="py-8 text-center text-sm text-gray-500">
        Loading preferences…
      </div>
    );
  }

  if (error || !prefs) {
    return (
      <div role="alert" className="py-8 text-center text-sm text-red-600">
        {error ?? "Unable to load preferences."}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Notification Channels</h2>
      <p className="text-sm text-gray-500 mb-6">Choose how you want to be notified.</p>

      <ul className="divide-y divide-gray-100" role="list">
        {CHANNELS.map(({ key, label, description }) => (
          <li key={key} className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs[key]}
              aria-label={`Toggle ${label} notifications`}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#2600FF] focus:ring-offset-2 ${
                prefs[key] ? "bg-[#2600FF]" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  prefs[key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>

      {toast && (
        <Toast variant={toast.variant} title={toast.title} description={toast.description} />
      )}
    </div>
  );
}
