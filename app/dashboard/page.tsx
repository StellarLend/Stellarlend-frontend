"use client";
import Image from "next/image";

import MetricsCards from "@/components/features/dashboard/components/MetricsCards";
import { DashboardLayout } from "@/components";
import { RecentTransactions } from "@/components/shared/common/RecentTransactions";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="">
        <div className="md:pt-10 md:border-t px-6 md:px-12 flex-col-reverse md:flex-col flex">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center md:mb-8">
            <h1 className="text-white md:text-[24px] text-xl font-bold mb-6 md:mb-0 md:block hidden">
              Dashboard
            </h1>

            <div className="flex flex-row gap-4 w-full sm:w-auto">
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
            </div>
          </div>
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
