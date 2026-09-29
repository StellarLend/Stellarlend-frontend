"use client";

import { DashboardLayout } from "@/components";
import { PageHeader } from "@/components/shared/common";
import PreferencesForm from "@/components/features/account/components/PreferencesForm";
import NotificationPreferences from "@/components/features/account/components/NotificationPreferences";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="md:pt-10 md:border-t px-6 md:px-12 flex flex-col gap-8 pb-12">
        <PageHeader
          title="Settings"
          description="Manage your display preferences, notification channels, and account options."
        />

        <section aria-labelledby="preferences-heading">
          <h2
            id="preferences-heading"
            className="text-white text-lg font-semibold mb-4"
          >
            Display &amp; Locale
          </h2>
          <div className="bg-white/5 rounded-xl p-6">
            <PreferencesForm />
          </div>
        </section>

        <section aria-labelledby="notifications-heading">
          <h2
            id="notifications-heading"
            className="text-white text-lg font-semibold mb-4"
          >
            Notification Channels
          </h2>
          <div className="bg-white/5 rounded-xl p-6">
            <NotificationPreferences />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
