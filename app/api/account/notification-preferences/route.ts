import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { withCsrfProtection } from "@/lib/api/handler";

const LIQUIDATION_WARNING_EVENT = "liquidation_warning";
const subscriptionsByEvent = new Map<string, Set<string>>();
const userSubscriptions = new Map<string, Set<string>>();

function getSubscriptions(eventType: string): Set<string> {
  const existing = subscriptionsByEvent.get(eventType);
  if (existing) {
    return existing;
  }

  const created = new Set<string>();
  subscriptionsByEvent.set(eventType, created);
  return created;
}

function getUserSubscriptionKey(userId: string, eventType: string): string {
  return `${userId}:${eventType}`;
}

function getUserOwnedSubscriptions(userId: string, eventType: string): Set<string> {
  const key = getUserSubscriptionKey(userId, eventType);
  const existing = userSubscriptions.get(key);
  if (existing) {
    return existing;
  }
  const created = new Set<string>();
  userSubscriptions.set(key, created);
  return created;
}

function isValidEventType(eventType: unknown): eventType is string {
  return eventType === LIQUIDATION_WARNING_EVENT;
}

function isValidPositionId(positionId: unknown): positionId is string {
  return typeof positionId === "string" && positionId.length > 0 && positionId.length <= 128;
}

const getHandler = async (request: NextRequest) => {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventType =
    request.nextUrl.searchParams.get("eventType") ?? LIQUIDATION_WARNING_EVENT;

  if (!isValidEventType(eventType)) {
    return NextResponse.json(
      { error: "Unsupported notification event type" },
      { status: 400 },
    );
  }

  const userOwned = getUserOwnedSubscriptions(user.id, eventType);
  const allSubscriptions = getSubscriptions(eventType);

  allSubscriptions.forEach((posId) => {
    if (userOwned.has(posId)) {
      return;
    }
  });

  return NextResponse.json({
    eventType,
    subscriptions: Array.from(userOwned),
  });
};

export const GET = withCsrfProtection(getHandler);

const putHandler = async (request: NextRequest) => {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { eventType: eventTypeRaw, positionId: positionIdRaw, enabled: enabledRaw } = body as Record<string, unknown>;

  const eventType = eventTypeRaw ?? LIQUIDATION_WARNING_EVENT;

  if (!isValidEventType(eventType)) {
    return NextResponse.json(
      { error: "Unsupported notification event type" },
      { status: 400 },
    );
  }

  if (!isValidPositionId(positionIdRaw)) {
    return NextResponse.json(
      { error: "Invalid position ID" },
      { status: 400 },
    );
  }

  const positionId = (positionIdRaw as string).trim();

  if (typeof enabledRaw !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 },
    );
  }

  const userOwned = getUserOwnedSubscriptions(user.id, eventType);
  const allSubscriptions = getSubscriptions(eventType);

  if (enabledRaw) {
    userOwned.add(positionId);
    allSubscriptions.add(positionId);
  } else {
    userOwned.delete(positionId);
    const otherUsersOwn = Array.from(userSubscriptions.entries()).some(
      ([key, subs]) => key !== getUserSubscriptionKey(user.id, eventType) && subs.has(positionId),
    );
    if (!otherUsersOwn) {
      allSubscriptions.delete(positionId);
    }
  }

  return NextResponse.json({
    eventType,
    positionId,
    enabled: enabledRaw,
    subscriptions: Array.from(userOwned),
  });
};

export const PUT = withCsrfProtection(putHandler);
