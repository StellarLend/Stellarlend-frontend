import React from "react";
import { render, screen, waitFor } from "@/test/test-utils";
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

describe("NotificationBell", () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  afterEach(() => {
    streamFn.mockReset();
    pinsFn.mockReset();
  });

  describe("badge and label", () => {
    it("hides the badge and exposes a no-unread label when count is zero", () => {
      render(<NotificationBell />);
      expect(screen.queryByText("99+")).not.toBeInTheDocument();
      expect(screen.getByLabelText("No unread notifications")).toBeInTheDocument();
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
});
