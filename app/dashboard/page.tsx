import { DashboardLayout } from "@/components";
import { ServerGreeting } from "./component/server-greeting";
import DashboardClient from "./DashboardClient";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <ServerGreeting />
      <DashboardClient />
    </DashboardLayout>
  );
}
