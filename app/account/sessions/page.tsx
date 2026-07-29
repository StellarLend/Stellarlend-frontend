"use client";

import { SessionsList } from "@/components/features/account/components";
import Sidebar from "@/components/shared/layout/Sidebar";
import { PageHeader } from "@/components/shared/common/PageHeader";

export default function AccountSessionsPage() {
  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
        <Sidebar />

        <div className="flex-1 bg-white rounded-lg shadow-sm p-4 md:p-6">
          <PageHeader
            tone="light"
            title="Active sessions"
            description="Review the devices currently signed in to your account and revoke any you don't recognise."
          />

          <div className="mt-6">
            <SessionsList />
          </div>
        </div>
      </div>
    </div>
  );
}
