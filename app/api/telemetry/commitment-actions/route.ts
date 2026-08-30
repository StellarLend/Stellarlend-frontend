/**
 * Telemetry collection endpoint for commitment actions
 * Receives client-side telemetry and logs for monitoring
 */

import { NextResponse } from "next/server";
import type { TelemetryEvent } from "@/types/commitment";

/**
 * POST /api/telemetry/commitment-actions
 * Collect telemetry events from clients
 */
export async function POST(request: Request) {
  try {
    const { events }: { events: TelemetryEvent[] } = await request.json();

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: { message: "Invalid events format" } },
        { status: 400 },
      );
    }

    // Validate events
    const validEvents = events.filter(
      (event) =>
        event &&
        typeof event === "object" &&
        event.type &&
        event.timestamp &&
        event.commitmentId,
    );

    if (validEvents.length === 0) {
      return NextResponse.json({ received: 0 }, { status: 200 });
    }

    // In production, send to monitoring service (Datadog, New Relic, CloudWatch, etc.)
    // For now, log to server console
    if (process.env.NODE_ENV === "production") {
      // Example: Send to external monitoring
      // await sendToDatadog(validEvents);
      // await sendToNewRelic(validEvents);
      
      // Log aggregated metrics
      const eventTypes = validEvents.reduce(
        (acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      console.log("[Telemetry] Commitment actions:", {
        count: validEvents.length,
        eventTypes,
        timeRange: {
          start: new Date(Math.min(...validEvents.map((e) => e.timestamp))),
          end: new Date(Math.max(...validEvents.map((e) => e.timestamp))),
        },
      });
    } else {
      // Development: Log individual events for debugging
      validEvents.forEach((event) => {
        const logLevel = event.type.includes("error") || event.type.includes("failed") 
          ? "error" 
          : "log";
        console[logLevel]("[Telemetry]", {
          type: event.type,
          action: event.action,
          commitmentId: event.commitmentId.slice(0, 8),
          latencyMs: event.latencyMs,
          errorType: event.errorType,
        });
      });
    }

    return NextResponse.json(
      { received: validEvents.length },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[Telemetry] Error processing telemetry:", error);
    // Always return success to avoid blocking client
    return NextResponse.json({ received: 0 }, { status: 200 });
  }
}
