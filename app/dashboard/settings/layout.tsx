import type { ReactNode } from "react";
import ProtectedRouteLayout from "@/components/auth/ProtectedRouteLayout";
import DashboardLayout from "@/components/shared/layout/DashboardLayout";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRouteLayout returnTo="/dashboard/settings">
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRouteLayout>
  );
}
