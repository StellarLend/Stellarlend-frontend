import React from "react";
import { render, screen } from "@/test/test-utils";
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

describe("NotificationBell memoization", () => {
  beforeEach(() => {
    streamFn.mockReturnValue({ unreadCount: 0 });
    pinsFn.mockReturnValue({
      pinnedIds: new Set<string>(),
      togglePin: vi.fn(),
      isPinned: vi.fn().mockReturnValue(false),
    });
  });

  afterEach(() => {
    streamFn.mockReset();
    pinsFn.mockReset();
  });

  it("does not recompute display values when unreadCount is unchanged", () => {
    const { container, rerender } = render(<NotificationBell />);
    expect(
      screen.getByLabelText("No unread notifications"),
    ).toBeInTheDocument();

    const initialHtml = container.innerHTML;

    rerender(<NotificationBell />);

    expect(container.innerHTML).toBe(initialHtml);
  });

  it("updates badge when a new notification arrives", () => {
    const { rerender } = render(<NotificationBell />);
    expect(
      screen.getByLabelText("No unread notifications"),
    ).toBeInTheDocument();

    streamFn.mockReturnValue({ unreadCount: 3 });
    rerender(<NotificationBell />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByLabelText("3 unread notifications")).toBeInTheDocument();
  });

  it("updates badge when notifications are marked as read", () => {
    streamFn.mockReturnValue({ unreadCount: 7 });
    const { rerender } = render(<NotificationBell />);
    expect(screen.getByText("7")).toBeInTheDocument();

    streamFn.mockReturnValue({ unreadCount: 2 });
    rerender(<NotificationBell />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByLabelText("2 unread notifications")).toBeInTheDocument();
  });

  it("transitions from zero to non-zero and back to zero", () => {
    const { rerender } = render(<NotificationBell />);
    expect(screen.queryByText("99+")).not.toBeInTheDocument();

    streamFn.mockReturnValue({ unreadCount: 1 });
    rerender(<NotificationBell />);
    expect(screen.getByText("1")).toBeInTheDocument();

    streamFn.mockReturnValue({ unreadCount: 0 });
    rerender(<NotificationBell />);
    expect(
      screen.getByLabelText("No unread notifications"),
    ).toBeInTheDocument();
  });

  it("keeps 99+ cap when count stays above threshold across re-renders", () => {
    streamFn.mockReturnValue({ unreadCount: 150 });
    const { rerender } = render(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();

    streamFn.mockReturnValue({ unreadCount: 200 });
    rerender(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
