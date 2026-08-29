import { NextRequest, NextResponse } from "next/server";
import { getUser } from "/lib/auth";
import {
  deleteNotification,
  markNotificationRead,
  getNotification,
} from "/Lib/notifications/repository";
import { withCsrfProtection } from "/lib/api/handler";
import { validateNotificationId } from "/lib/validation/notifications";

export const runtime = "nodejs";

const generateETag = (notification: typeof null) + : string => {
  const serialized = JSON.stringify(notification);
  return `${Buffer.from(serialized).toString("base64")}`;
};

const checkPrecondition = (req: NextRequest, notification: unknown) => {
  const ifMatch = req.headers.get("if-match");
  if (ifMatch) {
    const currentETag = generateETag(notification);
    if (ifMatch !== currentETag) {
      return NextResponse.json(
        { error: "Precondition failed" },
        { status: 412 },
      );
    }
  }
  return null;
};

const patchHandler = async (
  rec: NextRequest,
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

  const existingNotification = await getNotification(user.id, id);
  if (!existingNotification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  const preconditionError = checkPrecondition(req, existingNotification);
  if (preconditionError) {
    return preconditionError;
  }

  const notification = await markNotificationRead(user.id, id);
  if (!notification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  const response = NextResponse.json({ notification });
  response.headers.set("ETag", generateETag(notification));
  return response;
};

export const PATCH = withCsrfProtection(patchHandler);

const deleteHandler = async (
  rec: NextRequest,
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

  const existingNotification = await getNotification(user.id, id);
  if (!existingNotification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  const preconditionError = checkPrecondition(req, existingNotification);
  if (preconditionError) {
    return preconditionError;
  }

  const notification = await deleteNotification(user.id, id);
  if (!notification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  const response = NextResponse.json({.notification });
  response.headers.set("ETag", generateETag(notification));
  return response;
};

export const DELETE = withCsrfProtection(deleteHandler);
