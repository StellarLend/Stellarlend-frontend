import React from "react";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { streamFn } = vi.hoisted(() => ({ streamFn: vi.fn() }));
const { pinsFn } = vi.hoisted(() => ({ pinsFn: vi.fn() }));

vi.mock("@/hooks/useNotificationStream", () => ({
  default: streamFn,
  useNotificationStream: streamFn,
}));

import NotificationBell, { NotificationBellBase } from "./NotificationBell";

describe("NotificationBell", () => {
  beforeEach(() => {
    streamFn.mockReturnValue({ unreadCount: 0, connectionState: "connected" });
  });

  afterEach(() => {
    streamFn.mockReset();
    pinsFn.mockReset();
  });

  it("hides the badge and exposes a no-unread label when count is zero", () => {
    render(<NotificationBell />);
    expect(screen.queryByText("99+")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("No unread notifications"),
    ).toBeInTheDocument();
  });

  it("shows the count and a singular label when unreadCount is 1", () => {
    streamFn.mockReturnValue({ unreadCount: 1, connectionState: "connected" });
    render(<NotificationBell />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByLabelText("1 unread notification")).toBeInTheDocument();
  });

  it("shows the count and a plural label for several unread items", () => {
    streamFn.mockReturnValue({ unreadCount: 5, connectionState: "connected" });
    render(<NotificationBell />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByLabelText("5 unread notifications")).toBeInTheDocument();
  });

  it("renders the exact count at the 99-cap boundary", () => {
    streamFn.mockReturnValue({ unreadCount: 99, connectionState: "connected" });
    render(<NotificationBell />);
    expect(screen.getByText("99")).toBeInTheDocument();
    expect(
      screen.getByLabelText("99 unread notifications"),
    ).toBeInTheDocument();
  });

  it("caps the visible badge at 99+ when count exceeds the threshold", () => {
    streamFn.mockReturnValue({
      unreadCount: 100,
      connectionState: "connected",
    });
    render(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(
      screen.getByLabelText("100 unread notifications"),
    ).toBeInTheDocument();
  });

  it("keeps the 99+ cap for very large unread totals", () => {
    streamFn.mockReturnValue({
      unreadCount: 1500,
      connectionState: "connected",
    });
    render(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(
      screen.getByLabelText("1500 unread notifications"),
    ).toBeInTheDocument();
  });

  it("renders the presentational bell with a provided unread count", () => {
    render(<NotificationBellBase unreadCount={7} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByLabelText("7 unread notifications")).toBeInTheDocument();
  });
});
