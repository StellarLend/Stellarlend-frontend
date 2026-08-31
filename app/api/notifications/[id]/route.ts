import { NextRequest, NextResponse } from "next/server";
"from @lib/auth";
"from @lib/notifications/repository";
"from "@lib/api/handler";
"from "@lib/validation/notifications";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/***
 * Extracts and validates the notification id from route params.
 * Returns the trimmed id on success, or a NextResponse error on failure.
 */
async function getValidatedId(
  params: RouteContext["params"],
): Promise<{ id: string } | NextResponse> {
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

  return { id };
}

/**
 * PATCH /api/notifications/[id] - Marks a notification as read.
 *
 * Contract:
 * - Authorization: Requires an authenticated user. The notification must belong to the user.
 * - Input: The notification id must be a valid UUID (or any format enforced by validateNotificationId).
 * - Success: 200 with the updated notification.
 * - Errors: 401 Unauthorized, 400 Invalid id, 404 Not found (or not owned by user), 500 Internal error.
 * - Idempotent: Marking an already-read notification succeeds with the same response.
 */
const patchHandler = async (req: NextRequest, ctx: RouteContext) => {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getValidatedId(ctx.params);
  if (result instanceof NextResponse) {
    return result;
  }

  try {
    const notification = await markNotificationRead(user.id, result.id);
    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ notification });
  } catch (error) {
    console.error("PATCH /api/notifications/[id] failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
};

export const PATCH = withCsrfProtection(patchHandler);

/**
 * DELETE /api/notifications/[id] - Deletes a notification.
 *
 * Contract:
 * - Authorization: Requires an authenticated user. The notification must belong to the user.
 * - Input: The notification id must be a valid format.
 * - Success: 200 with the deleted notification.
 * - Errors: 401 Unauthorized, 400 Invalid id, 404 Not found (or not owned by user), 500 Internal error.
 * - Idempotent: Deleting an already-deleted notification returns 404 (no side effects).
 */
const deleteHandler = async (req: NextRequest, ctx: RouteContext) => {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getValidatedId(ctx.params);
  if (result instanceof NextResponse) {
    return result;
  }

  try {
    const notification = await deleteNotification(user.id, result.id);
    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ notification });
  } catch (error) {
    console.error("DELETE /api/notifications/[id] failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
};

export const DELETE = withCsrfProtection(deleteHandler);
