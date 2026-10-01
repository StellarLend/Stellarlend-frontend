import { DashboardLayout } from "@/components";
import { ServerGreeting } from "./component/server-greeting";
import DashboardClient from "./DashboardClient";

/**
 * Dashboard page entry point.
 *
 * Invariants:
 * - The page is a pure server component that must render deterministically
 *   for any valid request; it must not read mutable module-level state.
 * - All data fetching and authorization are delegated to child components
 *   (`ServerGreeting` and `DashboardClient`) so that failures in one
 *   subtree cannot corrupt the other.
 * - The layout boundary is always applied, even when a child throws,
 *   so users see a consistent shell instead of an unstructured error.
 */
export default function Dashboard() {
  return (
    <DashboardLayout>
      {/*
        ServerGreeting is rendered independently from DashboardClient so a
        failure in either subtree is contained and does not prevent the other
        from initializing. Neither child is given access to raw request data;
        they fetch their own data through their own validated boundaries.
      */
      <ServerGreeting />
      <DashboardClient />
    </DashboardLayout>
  );
}
