import React from "react";
import TopNav from "@/components/shared/layout/TopNav";
import { SideNav } from "./SideNav";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-[#15A350] w-full flex">
      <SideNav />
      <div className="w-full">
        <TopNav />
        <main className="">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
