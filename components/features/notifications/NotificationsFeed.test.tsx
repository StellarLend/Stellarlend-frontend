import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import NotificationsFeed from "./NotificationsFeed";
import type { Notification } from "@/lib/notifications/types";

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    userId: "u1",
    title: "Title",
    message: "Message",
    read: false,
    createdAt: new Date().toISOString(),
    type: "info",
    ...overrides,
  };
}

// Fixed "now" helpers: today / earlier this week / older
const TODAY = new Date();
const EARLIER = new Date(TODAY);
EARLIER.setDate(TODAY.getDate() - 2);
if (EARLIER.getDay() === 0) EARLIER.setDate(EARLIER.getDate() - 1);
const OLDER = new Date(TODAY);
OLDER.setDate(TODAY.getDate() - 14);

const fixture: Notification[] = [
  makeNotif({
    id: "t1",
    type: "warning",
    title: "Liquidation risk",
    createdAt: TODAY.toISOString(),
  }),
  makeNotif({
    id: "t2",
    type: "success",
    title: "Deposit ok",
    createdAt: TODAY.toISOString(),
    read: true,
  }),
  makeNotif({
    id: "t3",
    type: "info",
    title: "Weekly summary",
    createdAt: EARLIER.toISOString(),
  }),
  makeNotif({
    id: "t4",
    type: "error",
    title: "Failed repay",
    createdAt: OLDER.toISOString(),
  }),
];

describe("NotificationsFeed", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: fixture }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows type tabs with counts", () => {
    render(<NotificationsFeed initialNotifications={fixture} />);
    expect(screen.getByRole("tab", { name: /all/i })).toHaveTextContent("4");
    expect(screen.getByRole("tab", { name: /warning/i })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /success/i })).toHaveTextContent("1");
  });

  it("filters by type tab", async () => {
    const user = userEvent.setup();
    render(<NotificationsFeed initialNotifications={fixture} />);

    await user.click(screen.getByRole("tab", { name: /warning/i }));
    expect(screen.getByTestId("feed-item-t1")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-item-t2")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /warning/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows empty-per-tab state", async () => {
    const user = userEvent.setup();
    render(
      <NotificationsFeed
        initialNotifications={[makeNotif({ id: "only", type: "info" })]}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /error/i }));
    expect(screen.getByTestId("feed-empty")).toHaveTextContent(/no error/i);
  });

  it("groups by day sections when multiple ages present", () => {
    render(<NotificationsFeed initialNotifications={fixture} />);
    // At least today group should exist
    expect(screen.getByTestId("notif-group-today")).toBeInTheDocument();
    expect(screen.getByTestId("notif-group-older")).toBeInTheDocument();
  });

  it("supports arrow-key tab navigation", async () => {
    const user = userEvent.setup();
    render(<NotificationsFeed initialNotifications={fixture} />);
    const allTab = screen.getByRole("tab", { name: /^all/i });
    await user.click(allTab);
    await user.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^info/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  it("handles a single notification", () => {
    render(
      <NotificationsFeed
        initialNotifications={[
          makeNotif({ id: "solo", type: "success", title: "Only one" }),
        ]}
      />,
    );
    expect(screen.getByText("Only one")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /all/i })).toHaveTextContent("1");
  });

  it("preserves mark-as-read for unread items", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <NotificationsFeed
        initialNotifications={[
          makeNotif({ id: "u1", read: false, title: "Unread one" }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark as read/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/u1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
