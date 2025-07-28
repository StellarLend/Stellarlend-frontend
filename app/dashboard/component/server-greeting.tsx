// app/dashboard/components/server-greeting.tsx
import { getUser } from "@/lib/auth";

export async function ServerGreeting() {
  const user = await getUser();
  return <div>Hello, {user.name}!</div>;
}
