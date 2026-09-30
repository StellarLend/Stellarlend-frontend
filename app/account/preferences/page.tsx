"use client";

import React from "react";
import Sidebar from "@/components/shared/layout/Sidebar";
import { PageHeader } from "@/components/shared/common";
import PreferencesForm from "@/components/features/account/components/PreferencesForm";

export default function PreferencesPage() {
  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
        <Sidebar />

        <div className="flex-1 bg-white rounded-lg shadow-sm p-4 md:p-6">
          <PageHeader
            tone="light"
            title="Preferences"
            description="Manage your display currency, language/locale, and notification settings."
          />
          <div className="mt-6">
            <PreferencesForm />
          </div>
        </div>
      </div>
    </div>
  );
}
