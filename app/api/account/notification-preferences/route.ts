import { NextRequest, NextResponse } from "next/server";

const LIQUIDATION_WARNING_EVENT = "liquidation_warning";
const subscriptionsByEvent = new Map<string, Set<string>>();

function getSubscriptions(eventType: string): Set<string> {
  const existing = subscriptionsByEvent.get(eventType);
  if (existing) {
    return existing;
  }

  const created = new Set<string>();
  subscriptionsByEvent.set(eventType, created);
  return created;
}

function isValidEventType(eventType: unknown): eventType is string {
  return eventType === LIQUIDATION_WARNING_EVENT;
}

function isValidPositionId(positionId: unknown): positionId is string {
  return typeof positionId === "string" && positionId.length > 0;
}

export async function GET(request: NextRequest) {
  const eventType =
    request.nextUrl.searchParams.get("eventType") ?? LIQUIDATION_WARNING_EVENT;

  if (!isValidEventType(eventType)) {
    return NextResponse.json(
      { error: "Unsupported notification event type" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    eventType,
    subscriptions: Array.from(getSubscriptions(eventType)),
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      eventType?: unknown;
      positionId?: unknown;
      enabled?: unknown;
    };
    const eventType = body.eventType ?? LIQUIDATION_WARNING_EVENT;

    if (!isValidEventType(eventType) || !isValidPositionId(body.positionId)) {
      return NextResponse.json(
        { error: "Invalid notification preference payload" },
        { status: 400 },
      );
    }

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 },
      );
    }

    const subscriptions = getSubscriptions(eventType);
    if (body.enabled) {
      subscriptions.add(body.positionId);
    } else {
      subscriptions.delete(body.positionId);
    }

    return NextResponse.json({
      eventType,
      positionId: body.positionId,
      enabled: body.enabled,
      subscriptions: Array.from(subscriptions),
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
