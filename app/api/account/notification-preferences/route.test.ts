import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/account/notification-preferences/route";

function makeRequest(
  method: "GET" | "PUT",
  url = "http://localhost/api/account/notification-preferences",
  body?: unknown,
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("/api/account/notification-preferences", () => {
  it("requires a userId on GET", async () => {
    const response = await GET(makeRequest("GET"));

    expect(response.status).toBe(400);
  });

  it("persists liquidation alert subscriptions through the preferences shape", async () => {
    const body = {
      userId: "wallet-1",
      locale: "en-US",
      displayCurrency: "USD",
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        loanAlerts: true,
        marketingEmails: false,
        liquidationAlerts: ["liquidation:XLM:USDC"],
      },
    };

    const putResponse = await PUT(makeRequest("PUT", undefined, body));
    expect(putResponse.status).toBe(200);

    const getResponse = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/account/notification-preferences?userId=wallet-1",
      ),
    );
    expect(getResponse.status).toBe(200);

    const json = await getResponse.json();
    expect(json.notifications.liquidationAlerts).toEqual([
      "liquidation:XLM:USDC",
    ]);
  });

  it("rejects invalid liquidation alert keys", async () => {
    const response = await PUT(
      makeRequest("PUT", undefined, {
        userId: "wallet-2",
        notifications: {
          liquidationAlerts: ["not-a-liquidation-key"],
        },
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      errors: {
        "notifications.liquidationAlerts.0": expect.any(String),
      },
    });
  });
});
