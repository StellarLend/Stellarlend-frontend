import React from "react";
import TopNav from "@/components/shared/layout/TopNav";
import { SideNav } from "./SideNav";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex">
      <SideNav />
      <div className="w-full min-h-screen bg-[#15A350] flex flex-col">
        <TopNav />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
