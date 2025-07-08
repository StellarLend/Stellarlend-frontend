import React from 'react';
import TopNav from "@/components/shared/layout/TopNav";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <main className="p-4">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
