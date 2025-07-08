"use client"
import ProfileForm from "@/components/features/account/components/ProfileForm";
import Sidebar from "@/components/shared/layout/Sidebar";
import { usePathname } from "next/navigation";

export default function Account() {
  const pathname = usePathname();

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
        <Sidebar />

        <div className="flex-1 bg-white rounded-lg shadow-sm p-4 md:p-6">
          {pathname === "/account/profile" && <ProfileForm />}
        </div>
      </div>
    </div>
  );
}
