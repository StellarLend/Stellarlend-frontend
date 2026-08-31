"use client";

import { DashboardLayout } from "@/components/shared/layout";
import { PageHeader } from "@/components/shared/common";
import { MarketsTable } from "@/components/features/lending/components/MarketsTable";
import { useAccount } from "wagmi";

export default function MarketsPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Please connect your wallet to view markets.</p>
      </div>
    );
  }

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
