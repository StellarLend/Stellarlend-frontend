"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

import MetricsCards from "@/components/features/dashboard/components/MetricsCards";
import PositionSummary from "@/components/features/dashboard/components/PositionSummary";
import { DashboardLayout } from "@/components";
import { AlertBanner, PageHeader } from "@/components/shared/common";
import { RecentTransactions } from "@/components/shared/common/RecentTransactions";
import type { AlertBannerSeverity } from "@/components/shared/common/AlertBanner";

interface PositionMetrics {
  nextDue: string;
  healthFactor: number;
}

interface DashboardAlertData {
  title: string;
  message: string;
  severity: AlertBannerSeverity;
  dismissKey: string;
}

const parseNextDueDays = (nextDue: string): number | undefined => {
  const match = nextDue.match(/(\d+)\s*days?/i);
  return match ? Number(match[1]) : undefined;
};

const getDashboardAlertData = (position: PositionMetrics): DashboardAlertData | null => {
  const dueDays = parseNextDueDays(position.nextDue);
  const dueSeverity: AlertBannerSeverity | undefined = dueDays === undefined
    ? undefined
    : dueDays <= 1
    ? "critical"
    : dueDays <= 3
    ? "warning"
    : dueDays <= 7
    ? "info"
    : undefined;

  const healthSeverity: AlertBannerSeverity | undefined = position.healthFactor <= 1.15
    ? "critical"
    : position.healthFactor <= 1.25
    ? "warning"
    : position.healthFactor <= 1.35
    ? "info"
    : undefined;

  const severity: AlertBannerSeverity | undefined =
    dueSeverity === "critical" || healthSeverity === "critical"
      ? "critical"
      : dueSeverity === "warning" || healthSeverity === "warning"
      ? "warning"
      : dueSeverity === "info" || healthSeverity === "info"
      ? "info"
      : undefined;

  if (!severity) {
    return null;
  }

  if (severity === "critical") {
    if (dueSeverity === "critical") {
      return {
        title: "Immediate action required",
        message: `Your next payment of ${position.nextDue} is due very soon. Add collateral or repay now to avoid liquidation risk.`,
        severity,
        dismissKey: `dashboard-alert-banner-${severity}`,
      };
    }

    return {
      title: "Collateral is critically weak",
      message: `Your health factor is ${position.healthFactor.toFixed(2)}, which puts your position at high liquidation risk.`,
      severity,
      dismissKey: `dashboard-alert-banner-${severity}`,
    };
  }

  if (severity === "warning") {
    if (dueSeverity === "warning") {
      return {
        title: "Payment due soon",
        message: `Your next payment of ${position.nextDue} is approaching. Keep an eye on your collateral health.`,
        severity,
        dismissKey: `dashboard-alert-banner-${severity}`,
      };
    }

    return {
      title: "Collateral health warning",
      message: `Your health factor is ${position.healthFactor.toFixed(2)}. Consider rebalancing to avoid escalation.`,
      severity,
      dismissKey: `dashboard-alert-banner-${severity}`,
    };
  }

  return {
    title: "Upcoming payment",
    message: `Your next payment of ${position.nextDue} is due within the next week.`,
    severity,
    dismissKey: `dashboard-alert-banner-${severity}`,
  };
};

export default function Dashboard() {
  const [alertData, setAlertData] = useState<DashboardAlertData | null>(null);

  useEffect(() => {
    fetch("/api/positions")
      .then((response) => response.json())
      .then((data) => {
        const alert = getDashboardAlertData({
          nextDue: data.nextDue,
          healthFactor: data.healthFactor,
        });

        setAlertData(alert);
      })
      .catch(console.error);
  }, []);

  return (
    <DashboardLayout>
      <div className="">
        <div className="md:pt-10 md:border-t px-6 md:px-12 flex-col-reverse md:flex-col flex">
          <PageHeader
            title="Dashboard"
            description="Track lending, borrowing, and collateral health at a glance."
            actions={
              <>
                <button className="bg-[#087734] hover:bg-[#0A3D1E] text-white border border-[#71B48D] rounded-lg flex items-center w-full sm:w-auto justify-center gap-2 py-3 px-6 transition-colors">
                  <Image
                    src="/icons/coins-01.svg"
                    alt="Lend"
                    width={20}
                    height={20}
                  />
                  <span>Lend More</span>
                </button>

                <button className="bg-[#07c456] hover:bg-[#0A3D1E] text-white border border-[#71B48D] rounded-lg flex items-center w-full sm:w-auto justify-center gap-2 py-3 px-6 transition-colors">
                  <Image
                    src="/icons/bank.svg"
                    alt="Borrow"
                    width={20}
                    height={20}
                  />
                  <span>Borrow Now</span>
                </button>
              </>
            }
          />

          {alertData ? (
            <div className="mb-6">
              <AlertBanner
                title={alertData.title}
                message={alertData.message}
                severity={alertData.severity}
                dismissKey={alertData.dismissKey}
              />
            </div>
          ) : null}

          <MetricsCards />
        </div>

        <div className="pt-8 ">
          <RecentTransactions />
        </div>
      </div>
    </DashboardLayout>
  );
}

const LendIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.66667 13.3333L3.33333 10L6.66667 6.66667"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.6667 10H3.33333"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BorrowIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.3333 6.66667L16.6667 10L13.3333 13.3333"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.33333 10H16.6667"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
