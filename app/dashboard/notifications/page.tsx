"use client";

import { DashboardLayout } from "@/components";
import { PageHeader } from "@/components/shared/common";
import NotificationsFeed from "@/components/features/notifications/NotificationsFeed";

export default function NotificationsPage() {
  return (
    <DashboardLayout>
      <div className="md:pt-10 md:border-t px-6 md:px-12 flex flex-col gap-6 pb-12">
        <PageHeader
          title="Notifications"
          description="Review alerts, payment reminders, and system messages for your account. Filter by type and browse by day."
        />

        <NotificationsFeed />
      </div>
    </DashboardLayout>
  );
}
