import React from 'react';
import TopNav from "@/components/Navbar/TopNav"; // adjust the path based on your folder structure
import DashboardSidebar from '@/components/DashboardSidebar';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="relative min-h-screen bg-gray-100 flex">
            <DashboardSidebar />
            <main className="w-full ml-0 lg:ml-[20%] xl:ml-[16%] lg:w-[80%] xl:w-[84%]">
                <TopNav />
                { children }
            </main>
        </div>
    );
};

export default DashboardLayout;
