import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listStoredSessions, touchStoredSession } from "@/lib/auth/session-store";

function getCurrentSessionId(session: Awaited<ReturnType<typeof getSession>>) {
  return session?.user?.id ?? null;
}

export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentSessionId = getCurrentSessionId(session);

  if (currentSessionId) {
    touchStoredSession(currentSessionId);
  }

  const sessions = listStoredSessions(session.user.id).map((item) => ({
    id: item.id,
    current: item.id === currentSessionId,
    device: {
      userAgent: item.userAgent,
      ipAddress: item.ipAddress,
    },
    createdAt: item.createdAt,
    lastSeenAt: item.lastSeenAt,
  }));

  return NextResponse.json({ sessions });
}