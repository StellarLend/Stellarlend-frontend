import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/notifications/repository", () => ({
  getNotifications: vi.fn(),
}));

import { GET } from "./route";
import { getUser } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications/repository";
import type { Notification } from "@/lib/notifications/types";

const mockGetUser = vi.mocked(getUser);
const mockGetNotifications = vi.mocked(getNotifications);

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notif-1",
    userId: "user-1",
    title: "Deposit Confirmed",
    message: "Your deposit has been confirmed.",
    read: true,
    createdAt: "2026-05-26T10:00:00.000Z",
    type: "success",
    ...overrides,
  };
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce(null as any);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockGetNotifications).not.toHaveBeenCalled();
  });

  it("returns the caller's notifications with an unread count computed from a mixed fixture", async () => {
    const notifications = [
      notification({ id: "notif-1", read: false }),
      notification({ id: "notif-2", read: true }),
      notification({ id: "notif-3", read: false }),
      notification({ id: "notif-4", read: true }),
    ];
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);
    mockGetNotifications.mockResolvedValueOnce(notifications);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetNotifications).toHaveBeenCalledWith("user-1");
    expect(body).toEqual({ notifications, unreadCount: 2 });
  });

  it("reports a zero unread count when every notification is read", async () => {
    const notifications = [
      notification({ id: "notif-1", read: true }),
      notification({ id: "notif-2", read: true }),
    ];
    mockGetUser.mockResolvedValueOnce({ id: "user-1" } as any);
    mockGetNotifications.mockResolvedValueOnce(notifications);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ notifications, unreadCount: 0 });
  });
});
