import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStoredSession, revokeStoredSession } from "@/lib/auth/session-store";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = getStoredSession(context.params.id);

  if (!target || target.userId !== session.user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const isCurrentSession = target.id === session.user.id;
  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (isCurrentSession && !confirmed) {
    return NextResponse.json(
      { error: "Cannot revoke current session without confirm=true" },
      { status: 400 }
    );
  }

  revokeStoredSession(context.params.id);

  console.info("audit.session.revoked", {
    sessionId: context.params.id,
    userId: session.user.id,
    revokedAt: new Date().toISOString(),
  });

  return NextResponse.json({ revoked: true });
}