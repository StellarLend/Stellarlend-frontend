// app/dashboard/components/server-greeting.tsx
import { getUser } from "@/lib/auth";

export async function ServerGreeting() {
  const user = await getUser();

  // Handle unauthenticated state
  if (!user) {
    return (
      <div className="text-gray-500">
        <p>Welcome to Stellarlend</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Hello, {user.name}!</h1>
      <p className="text-gray-600">
        {user.email}
        {user.walletAddress && <span> • {user.walletAddress}</span>}
      </p>
    </div>
  );
}
