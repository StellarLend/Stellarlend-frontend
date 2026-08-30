import type { ReactNode } from "react";
import ProtectedRouteLayout from "@/components/auth/ProtectedRouteLayout";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRouteLayout returnTo="/dashboard/settings">
      {children}
    </ProtectedRouteLayout>
  );
}
