"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Save } from "lucide-react";
import Toast from "@/components/shared/common/Toast";
import type { ToastVariant } from "@/components/shared/common/Toast";

const LOCALE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "ja", label: "Japanese" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "ko", label: "Korean" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "XLM", label: "XLM - Stellar Lumens" },
  { value: "BTC", label: "BTC - Bitcoin" },
  { value: "ETH", label: "ETH - Ethereum" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "KRW", label: "KRW - South Korean Won" },
  { value: "BRL", label: "BRL - Brazilian Real" },
];

const NOTIFICATION_CHANNELS = [
  { id: "email", label: "Email", description: "Receive notifications via email" },
  { id: "push", label: "Push", description: "Receive push notifications" },
  { id: "sms", label: "SMS", description: "Receive notifications via SMS" },
  { id: "inApp", label: "In-App", description: "Receive in-app notifications" },
];

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

interface PreferencesData {
  userId: string;
  locale: string;
  displayCurrency: string;
  notifications: NotificationPreferences;
  updatedAt: string | null;
}

interface FormErrors {
  locale?: string;
  displayCurrency?: string;
  [key: string]: string | undefined;
}

export default function PreferencesForm() {
  const [preferences, setPreferences] = useState<PreferencesData | null>(null);
  const [locale, setLocale] = useState("en-US");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email: true,
    push: true,
    sms: false,
    inApp: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<{
    variant: ToastVariant;
    title: string;
    description?: string;
  } | null>(null);

  const showToast = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      setToast({ variant, title, description });
      setTimeout(() => setToast(null), 5000);
    },
    []
  );

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/account/preferences");
        if (!res.ok) {
          throw new Error("Failed to load preferences");
        }
        const data: PreferencesData = await res.json();
        setPreferences(data);
        setLocale(data.locale || "en-US");
        setDisplayCurrency(data.displayCurrency || "USD");
        setNotifications(
          data.notifications || {
            email: true,
            push: true,
            sms: false,
            inApp: true,
          }
        );
      } catch {
        showToast("error", "Failed to load preferences");
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [showToast]);

  const handleNotificationToggle = (channel: keyof NotificationPreferences) => {
    setNotifications((prev) => ({ ...prev, [channel]: !prev[channel] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});

    try {
      const res = await fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          displayCurrency,
          notifications,
        }),
      });

      if (res.status === 422) {
        const body = await res.json();
        setErrors(body.errors || {});
        showToast("error", "Validation failed", "Please fix the highlighted fields.");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to save preferences");
      }

      const data: PreferencesData = await res.json();
      setPreferences(data);
      showToast("success", "Preferences saved", "Your preferences have been updated.");
    } catch {
      showToast("error", "Save failed", "An error occurred while saving your preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        data-testid="preferences-loading"
      >
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" aria-hidden="true" />
        <span className="ml-2 text-sm text-gray-500">Loading preferences...</span>
      </div>
    );
  }

  return (
    <div data-testid="preferences-form">
      <div className="mb-8 border-b border-gray-100 pb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Notification Preferences
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your language, currency, and notification settings.
        </p>
      </div>

      <div className="space-y-8">
        <div className="bg-white border border-gray-100 rounded-lg p-4 sm:p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            Language & Currency
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            Choose your preferred language and display currency.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="locale"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Language / Locale
              </label>
              <select
                id="locale"
                value={locale}
                onChange={(e) => {
                  setLocale(e.target.value);
                  if (errors.locale) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.locale;
                      return next;
                    });
                  }
                }}
                className={`w-full text-gray-900 text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#2600FF] focus:border-transparent ${
                  errors.locale
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:border-[#2600FF]"
                }`}
                data-testid="locale-select"
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.locale && (
                <p
                  className="mt-1 text-xs text-red-600"
                  data-testid="locale-error"
                >
                  {errors.locale}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="displayCurrency"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Display Currency
              </label>
              <select
                id="displayCurrency"
                value={displayCurrency}
                onChange={(e) => {
                  setDisplayCurrency(e.target.value);
                  if (errors.displayCurrency) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.displayCurrency;
                      return next;
                    });
                  }
                }}
                className={`w-full text-gray-900 text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#2600FF] focus:border-transparent ${
                  errors.displayCurrency
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:border-[#2600FF]"
                }`}
                data-testid="currency-select"
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.displayCurrency && (
                <p
                  className="mt-1 text-xs text-red-600"
                  data-testid="currency-error"
                >
                  {errors.displayCurrency}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg p-4 sm:p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            Notification Channels
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            Select which channels you want to receive notifications through.
          </p>

          <div className="space-y-4">
            {NOTIFICATION_CHANNELS.map((channel) => {
              const isChecked =
                notifications[channel.id as keyof NotificationPreferences];
              return (
                <label
                  key={channel.id}
                  className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                    isChecked
                      ? "border-[#2600FF] bg-[#2600FF]/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid={`notification-channel-${channel.id}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      handleNotificationToggle(
                        channel.id as keyof NotificationPreferences
                      )
                    }
                    className="h-4 w-4 text-[#2600FF] border-gray-300 rounded focus:ring-[#2600FF]"
                    data-testid={`notification-toggle-${channel.id}`}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {channel.label}
                    </span>
                    <p className="text-xs text-gray-500">
                      {channel.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            className="inline-flex items-center justify-center gap-2 sm:px-12 py-2.5 text-sm cursor-pointer bg-[#2600FF] hover:bg-[#1a00cc] disabled:bg-[#2600FF]/50 disabled:cursor-not-allowed text-white rounded-md font-medium shadow-md transition-colors duration-200"
            data-testid="save-preferences-btn"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
        />
      )}
    </div>
  );
}
