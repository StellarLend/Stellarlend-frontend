import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/api/handler", () => ({
  withCsrfProtection: <T extends (...args: any[]) => any>(handler: T) =>
    handler,
}));

import { GET, PUT } from "./route";
import { getUser } from "@/lib/auth";

const mockGetUser = vi.mocked(getUser);

function getRequest(eventType?: string) {
  const url = new URL("http://localhost:3000/api/account/notification-preferences");
  if (eventType) {
    url.searchParams.set("eventType", eventType);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function putRequest(body: unknown) {
  return new NextRequest(
    "http://localhost:3000/api/account/notification-preferences",
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("GET /api/account/notification-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce(null as any);

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for unsupported event type", async () => {
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);

    const response = await GET(getRequest("unsupported_event"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Unsupported notification event type" });
  });

  it("returns subscriptions for authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("eventType", "liquidation_warning");
    expect(body).toHaveProperty("subscriptions");
    expect(Array.isArray(body.subscriptions)).toBe(true);
  });
});

describe("PUT /api/account/notification-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce(null as any);

    const response = await PUT(putRequest({ enabled: true }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);

    const request = new NextRequest(
      "http://localhost:3000/api/account/notification-preferences",
      {
        method: "PUT",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 for unsupported event type", async () => {
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);

    const response = await PUT(
      putRequest({ eventType: "unsupported", positionId: "pos-1", enabled: true })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Unsupported notification event type" });
  });

  it("returns 400 for invalid position ID", async () => {
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);

    const response = await PUT(
      putRequest({ positionId: "", enabled: true })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid position ID" });
  });

  it("returns 400 when enabled is not a boolean", async () => {
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);

    const response = await PUT(
      putRequest({ positionId: "pos-1", enabled: "yes" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "enabled must be a boolean" });
  });

  it("successfully adds a subscription", async () => {
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);

    const response = await PUT(
      putRequest({ positionId: "pos-1", enabled: true })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      eventType: "liquidation_warning",
      positionId: "pos-1",
      enabled: true,
      subscriptions: ["pos-1"],
    });
  });

  it("successfully removes a subscription", async () => {
    mockGetUser
      .mockResolvedValueOnce({ id: "user-1" } as any)
      .mockResolvedValueOnce({ id: "user-1" } as any);

    await PUT(putRequest({ positionId: "pos-1", enabled: true }));
    const response = await PUT(
      putRequest({ positionId: "pos-1", enabled: false })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      eventType: "liquidation_warning",
      positionId: "pos-1",
      enabled: false,
      subscriptions: [],
    });
  });

  describe("authorization and isolation", () => {
    it("does not expose another user's subscriptions", async () => {
      mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);
      await PUT(putRequest({ positionId: "pos-user1", enabled: true }));

      mockGetUser.mockResolvedValueOnce({ id: "user-2" } as any);
      const response = await GET(getRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.subscriptions).not.toContain("pos-user1");
    });

    it("rejects position ID exceeding maximum length", async () => {
      mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);

      const longPositionId = "a".repeat(129);
      const response = await PUT(
        putRequest({ positionId: longPositionId, enabled: true })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "Invalid position ID" });
    });
  });
});
