"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components";
import { PageHeader } from "@/components/shared/common";

/**
 * Fund-wallet entry point for the sidebar "Fundwallet" nav item.
 * Points users at the primary deposit / markets flows without a dead href="#".
 */
export default function FundWalletPage() {
  return (
    <DashboardLayout>
      <div className="md:pt-10 md:border-t px-6 md:px-12">
        <PageHeader
          title="Fund wallet"
          description="Deposit assets and open markets to put capital to work on Stellarlend."
        />
      </div>

      <div className="px-6 md:px-12 mt-8 flex flex-col gap-4 max-w-xl">
        <Link
          href="/markets"
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350]"
        >
          Browse markets
        </Link>
        <Link
          href="/lending"
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350]"
        >
          Go to lending
        </Link>
      </div>
    </DashboardLayout>
  );
}
