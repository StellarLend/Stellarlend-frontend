"use client";

import { DashboardLayout } from "@/components";
import { PageHeader } from "@/components/shared/common";
import NextPaymentDue from "@/components/features/dashboard/components/NextPaymentDue";
import LiquidationsPanel from "@/components/features/dashboard/components/LiquidationsPanel";

export default function LoanPage() {
  return (
    <DashboardLayout>
      <div className="md:pt-10 md:border-t px-6 md:px-12 flex flex-col gap-6">
        <PageHeader
          title="Loan Overview"
          description="Monitor your active loans, collateral health, and upcoming repayments."
        />

        <NextPaymentDue />

        <div className="mt-2">
          <LiquidationsPanel />
        </div>
      </div>
    </DashboardLayout>
  );
}
