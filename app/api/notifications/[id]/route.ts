import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  deleteNotification,
  markNotificationRead,
} from "@/lib/notifications/repository";
import { withCsrfProtection } from "@/lib/api/handler";
import { validateNotificationId } from "@/lib/validation/notifications";

export const runtime = "nodejs";

const patchHandler = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;

  if (typeof rawId !== "string") {
    return NextResponse.json(
      { error: "Invalid notification id" },
      { status: 400 },
    );
  }

  const id = rawId.trim();

  const validation = validateNotificationId(id);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid notification id" },
      { status: 400 },
    );
  }

  const notification = await markNotificationRead(user.id, id);
  if (!notification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ notification });
};

export const PATCH = withCsrfProtection(patchHandler);

const deleteHandler = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;

  if (typeof rawId !== "string") {
    return NextResponse.json(
      { error: "Invalid notification id" },
      { status: 400 },
    );
  }

  const id = rawId.trim();

  const validation = validateNotificationId(id);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid notification id" },
      { status: 400 },
    );
  }

  const notification = await deleteNotification(user.id, id);
  if (!notification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ notification });
};

export const DELETE = withCsrfProtection(deleteHandler);
