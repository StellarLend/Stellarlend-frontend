import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { validateServerProtectedSession } from "@/lib/auth/session-boundary";

interface ProtectedRouteLayoutProps {
  children: ReactNode;
  returnTo?: string;
}

export default async function ProtectedRouteLayout({
  children,
  returnTo = "/dashboard/settings",
}: ProtectedRouteLayoutProps) {
  const session = await getSession();

  try {
    validateServerProtectedSession(session);
  } catch {
    redirect(`/?returnUrl=${encodeURIComponent(returnTo)}`);
  }

  return <>{children}</>;
}
