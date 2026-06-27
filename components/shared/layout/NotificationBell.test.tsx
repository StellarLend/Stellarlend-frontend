import React from "react";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted is required because vitest hoists vi.mock calls above all
// module-level declarations — a plain `const` would still be in TDZ when
// the factory runs. We share a single vi.fn() reference across the default
// and named exports so the mocked hook is wired up regardless of which
// import style the consumer resolves.
const { streamFn } = vi.hoisted(() => ({ streamFn: vi.fn() }));

vi.mock("@/hooks/useNotificationStream", () => ({
  default: streamFn,
  useNotificationStream: streamFn,
}));

// Imports must come after vi.mock so they pick up the mocked module.
import NotificationBell from "./NotificationBell";

describe("NotificationBell", () => {
  beforeEach(() => {
    streamFn.mockReturnValue({ unreadCount: 0 });
  });

  afterEach(() => {
    streamFn.mockReset();
  });

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
