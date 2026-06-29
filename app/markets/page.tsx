"use client";

import { DashboardLayout } from "@/components/shared/layout";
import { PageHeader } from "@/components/shared/common";
import { MarketsTable } from "@/components/features/lending/components/MarketsTable";

export default function MarketsPage() {
  return (
    <DashboardLayout>
      <div className="px-6 md:px-12 pt-6 md:pt-10">
        <PageHeader
          title="Markets"
          description="Compare lending and borrowing rates across all supported assets."
          tone="light"
        />

        <section className="mt-6 pb-12">
          <MarketsTable />
        </section>
      </div>
    </DashboardLayout>
  );
}
