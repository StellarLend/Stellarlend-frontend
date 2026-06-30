import React from "react";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { streamFn } = vi.hoisted(() => ({ streamFn: vi.fn() }));
const { pinsFn } = vi.hoisted(() => ({ pinsFn: vi.fn() }));

vi.mock("@/hooks/useNotificationStream", () => ({
  default: streamFn,
  useNotificationStream: streamFn,
}));

vi.mock("@/hooks/useNotificationPins", () => ({
  useNotificationPins: pinsFn,
}));

import NotificationBell from "./NotificationBell";
import type { Notification } from "@/lib/notifications/types";

const mockNotifications: Notification[] = [
  {
    id: "n1",
    userId: "u1",
    title: "Deposit Confirmed",
    message: "Your deposit was confirmed.",
    read: false,
    createdAt: new Date().toISOString(),
    type: "success",
  },
  {
    id: "n2",
    userId: "u1",
    title: "Rate Update",
    message: "Lending rates changed.",
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    type: "info",
  },
  {
    id: "n3",
    userId: "u1",
    title: "Old Notification",
    message: "This is old.",
    read: false,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    type: "warning",
  },
];

function setupPinsMock(overrides?: Partial<ReturnType<typeof pinsFn>>) {
  const defaultMock: ReturnType<typeof pinsFn> = {
    pinnedIds: new Set<string>(),
    togglePin: vi.fn(),
    isPinned: vi.fn().mockReturnValue(false),
  };
  pinsFn.mockReturnValue({ ...defaultMock, ...overrides });
}

function setupDefaultMocks() {
  streamFn.mockReturnValue({ unreadCount: 0 });
  setupPinsMock();
}

function setupFetchMock(notifications: Notification[] = mockNotifications) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/notifications" && method === "GET") {
        return Response.json({ notifications });
      }

      if (url === "/api/notifications/read-all" && method === "PATCH") {
        return Response.json({ ok: true });
      }

      if (url.startsWith("/api/notifications/") && method === "PATCH") {
        return Response.json({ ok: true });
      }

      if (url.startsWith("/api/notifications/") && method === "DELETE") {
        return Response.json({ ok: true });
      }

      return new Response(null, { status: 404 });
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openPanel(options: { waitForFirstNotification?: boolean } = {}) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /notification/i }));
  await screen.findByTestId("notification-panel");
  if (options.waitForFirstNotification ?? true) {
    await screen.findByText("Deposit Confirmed");
  }
  return user;
}

describe("NotificationBell", () => {
  beforeEach(() => {
    setupDefaultMocks();
    setupFetchMock();
  });

  afterEach(() => {
    streamFn.mockReset();
    pinsFn.mockReset();
    vi.unstubAllGlobals();
  });

  describe("badge and label", () => {
    it("hides the badge and exposes a no-unread label when count is zero", () => {
      render(<NotificationBell />);
      expect(screen.queryByText("99+")).not.toBeInTheDocument();
      expect(
        screen.getByLabelText("No unread notifications"),
      ).toBeInTheDocument();
    });

    it("shows the count and a singular label when unreadCount is 1", () => {
      streamFn.mockReturnValue({ unreadCount: 1 });
      render(<NotificationBell />);
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(
        screen.getByLabelText("1 unread notification"),
      ).toBeInTheDocument();
    });

    it("shows the count and a plural label for several unread items", () => {
      streamFn.mockReturnValue({ unreadCount: 5 });
      render(<NotificationBell />);
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(
        screen.getByLabelText("5 unread notifications"),
      ).toBeInTheDocument();
    });

    it("renders the exact count at the 99-cap boundary", () => {
      streamFn.mockReturnValue({ unreadCount: 99 });
      render(<NotificationBell />);
      expect(screen.getByText("99")).toBeInTheDocument();
      expect(
        screen.getByLabelText("99 unread notifications"),
      ).toBeInTheDocument();
    });

    it("caps the visible badge at 99+ when count exceeds the threshold", () => {
      streamFn.mockReturnValue({ unreadCount: 100 });
      render(<NotificationBell />);
      expect(screen.getByText("99+")).toBeInTheDocument();
      expect(
        screen.getByLabelText("100 unread notifications"),
      ).toBeInTheDocument();
    });

    it("keeps the 99+ cap for very large unread totals", () => {
      streamFn.mockReturnValue({ unreadCount: 1500 });
      render(<NotificationBell />);
      expect(screen.getByText("99+")).toBeInTheDocument();
      expect(
        screen.getByLabelText("1500 unread notifications"),
      ).toBeInTheDocument();
    });
  });

  describe("dismiss actions", () => {
    it("dismisses a single notification and updates the local unread badge", async () => {
      streamFn.mockReturnValue({ unreadCount: 2 });
      render(<NotificationBell />);

      const user = await openPanel();
      await user.click(screen.getByTestId("dismiss-n1"));

      expect(screen.queryByText("Deposit Confirmed")).not.toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(
        screen.getByLabelText("1 unread notification"),
      ).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith("/api/notifications/n1", {
        method: "DELETE",
      });
    });

    it("restores a dismissed notification when the delete request fails", async () => {
      streamFn.mockReturnValue({ unreadCount: 2 });
      const fetchMock = setupFetchMock();
      fetchMock.mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString();
          const method = init?.method ?? "GET";

          if (url === "/api/notifications" && method === "GET") {
            return Response.json({ notifications: mockNotifications });
          }

          if (url === "/api/notifications/n1" && method === "DELETE") {
            return new Response(null, { status: 500 });
          }

          return Response.json({ ok: true });
        },
      );

      render(<NotificationBell />);

      const user = await openPanel();
      await user.click(screen.getByTestId("dismiss-n1"));

      await waitFor(() => {
        expect(screen.getByText("Deposit Confirmed")).toBeInTheDocument();
      });
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("clears all loaded notifications by deleting each item", async () => {
      streamFn.mockReturnValue({ unreadCount: 2 });
      render(<NotificationBell />);

      const user = await openPanel();
      await user.click(screen.getByTestId("clear-all-notifications"));

      expect(screen.getByTestId("empty-state")).toHaveTextContent(
        "No notifications yet",
      );
      expect(
        screen.getByLabelText("No unread notifications"),
      ).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith("/api/notifications/n1", {
        method: "DELETE",
      });
      expect(fetch).toHaveBeenCalledWith("/api/notifications/n2", {
        method: "DELETE",
      });
      expect(fetch).toHaveBeenCalledWith("/api/notifications/n3", {
        method: "DELETE",
      });
    });

    it("shows the empty state after dismissing the last loaded notification", async () => {
      streamFn.mockReturnValue({ unreadCount: 1 });
      setupFetchMock([mockNotifications[0]]);
      render(<NotificationBell />);

      const user = await openPanel();
      await user.click(screen.getByTestId("dismiss-n1"));

      expect(screen.getByTestId("empty-state")).toHaveTextContent(
        "No notifications yet",
      );
      expect(
        screen.getByLabelText("No unread notifications"),
      ).toBeInTheDocument();
    });

    it("does not render clear all when there are zero loaded notifications", async () => {
      setupFetchMock([]);
      render(<NotificationBell />);

      await openPanel({ waitForFirstNotification: false });

      expect(
        screen.queryByTestId("clear-all-notifications"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("empty-state")).toHaveTextContent(
        "No notifications yet",
      );
    });

    it("restores the list when clear all cannot delete every notification", async () => {
      streamFn.mockReturnValue({ unreadCount: 2 });
      const fetchMock = setupFetchMock();
      fetchMock.mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString();
          const method = init?.method ?? "GET";

          if (url === "/api/notifications" && method === "GET") {
            return Response.json({ notifications: mockNotifications });
          }

          if (url === "/api/notifications/n2" && method === "DELETE") {
            return new Response(null, { status: 500 });
          }

          return Response.json({ ok: true });
        },
      );

      render(<NotificationBell />);

      const user = await openPanel();
      await user.click(screen.getByTestId("clear-all-notifications"));

      await waitFor(() => {
        expect(screen.getByText("Deposit Confirmed")).toBeInTheDocument();
        expect(screen.getByText("Rate Update")).toBeInTheDocument();
        expect(screen.getByText("Old Notification")).toBeInTheDocument();
      });
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});
