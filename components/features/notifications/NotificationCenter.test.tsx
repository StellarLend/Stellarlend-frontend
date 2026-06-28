import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { streamFn } = vi.hoisted(() => ({ streamFn: vi.fn() }));

vi.mock("@/hooks/useNotificationStream", () => ({
  default: streamFn,
  useNotificationStream: streamFn,
}));

import NotificationCenter from "./NotificationCenter";
import type { Notification } from "@/lib/notifications/types";

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: "notif-1",
  userId: "user-1",
  title: "Deposit Confirmed",
  message: "Your XLM deposit has been confirmed.",
  read: false,
  createdAt: "2026-05-26T10:00:00Z",
  type: "success",
  ...overrides,
});

const twoNotifications: Notification[] = [
  makeNotification({ id: "notif-1", read: false }),
  makeNotification({ id: "notif-2", title: "Loan Due", message: "Payment due in 3 days.", read: true }),
];

function mockFetchSuccess(notifications: Notification[] = twoNotifications) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      }),
    }),
  );
}

function mockFetch401() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    }),
  );
}

function mockFetchError() {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
}

describe("NotificationCenter", () => {
  let capturedOnNotification: ((n: Notification) => void) | undefined;

  beforeEach(() => {
    capturedOnNotification = undefined;
    streamFn.mockImplementation((opts?: { onNotification?: (n: Notification) => void }) => {
      capturedOnNotification = opts?.onNotification;
      return { unreadCount: 0 };
    });
    mockFetchSuccess();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    streamFn.mockReset();
  });

  describe("initial load", () => {
    it("renders bell button after successful fetch", async () => {
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /unread notification/i })).toBeInTheDocument();
      });
    });

    it("shows unread badge with correct count", async () => {
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.getByTestId("unread-badge")).toBeInTheDocument();
        expect(screen.getByTestId("unread-badge")).toHaveTextContent("1");
      });
    });

    it("shows plural label when multiple unread", async () => {
      mockFetchSuccess([
        makeNotification({ id: "1", read: false }),
        makeNotification({ id: "2", read: false }),
      ]);
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.getByLabelText("2 unread notifications")).toBeInTheDocument();
      });
    });

    it("shows singular label when one unread", async () => {
      mockFetchSuccess([makeNotification({ id: "1", read: false })]);
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.getByLabelText("1 unread notification")).toBeInTheDocument();
      });
    });

    it("hides badge and shows no-unread label when all read", async () => {
      mockFetchSuccess([makeNotification({ id: "1", read: true })]);
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.queryByTestId("unread-badge")).not.toBeInTheDocument();
        expect(screen.getByLabelText("No unread notifications")).toBeInTheDocument();
      });
    });

    it("renders bell with no-unread label when notifications list is empty", async () => {
      mockFetchSuccess([]);
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.getByLabelText("No unread notifications")).toBeInTheDocument();
      });
    });

    it("caps badge at 99+ when unread count exceeds 99", async () => {
      const many = Array.from({ length: 105 }, (_, i) =>
        makeNotification({ id: `n-${i}`, read: false }),
      );
      mockFetchSuccess(many);
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.getByTestId("unread-badge")).toHaveTextContent("99+");
      });
    });
  });

  describe("401 — signed out", () => {
    it("renders nothing when initial fetch returns 401", async () => {
      mockFetch401();
      const { container } = render(<NotificationCenter />);
      await waitFor(() => {
        expect(container).toBeEmptyDOMElement();
      });
    });

    it("does not render the bell button on 401", async () => {
      mockFetch401();
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
      });
    });
  });

  describe("network error", () => {
    it("still renders bell when fetch throws", async () => {
      mockFetchError();
      render(<NotificationCenter />);
      await waitFor(() => {
        expect(screen.queryByTestId("notification-center")).toBeInTheDocument();
      });
    });
  });

  describe("dropdown panel", () => {
    it("panel is not visible initially", async () => {
      render(<NotificationCenter />);
      await waitFor(() => screen.getByRole("button", { name: /notification/i }));
      expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
    });

    it("opens panel on bell click", async () => {
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
    });

    it("sets aria-expanded=true when panel is open", async () => {
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    it("closes panel on second bell click (toggle)", async () => {
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
      fireEvent.click(trigger);
      expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
    });

    it("closes panel on Escape key", async () => {
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      const panel = screen.getByTestId("notification-panel");
      fireEvent.keyDown(panel, { key: "Escape" });
      expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
    });

    it("panel has role=dialog", async () => {
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows all notification titles in the panel", async () => {
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      expect(screen.getByText("Deposit Confirmed")).toBeInTheDocument();
      expect(screen.getByText("Loan Due")).toBeInTheDocument();
    });

    it("shows empty state when no notifications", async () => {
      mockFetchSuccess([]);
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /no unread/i });
      fireEvent.click(trigger);
      expect(screen.getByTestId("empty-state")).toHaveTextContent("No notifications yet");
    });

    it("shows Mark as read button only for unread items", async () => {
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      expect(screen.getByTestId("mark-read-notif-1")).toBeInTheDocument();
      expect(screen.queryByTestId("mark-read-notif-2")).not.toBeInTheDocument();
    });
  });

  describe("mark as read", () => {
    it("removes Mark as read button after clicking it (optimistic)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ notifications: twoNotifications, unreadCount: 1 }),
          })
          .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) }),
      );
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      const markBtn = screen.getByTestId("mark-read-notif-1");
      fireEvent.click(markBtn);
      await waitFor(() => {
        expect(screen.queryByTestId("mark-read-notif-1")).not.toBeInTheDocument();
      });
    });

    it("decrements unread badge after marking last unread item", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              notifications: [makeNotification({ id: "n1", read: false })],
              unreadCount: 1,
            }),
          })
          .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) }),
      );
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: "1 unread notification" });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId("mark-read-n1"));
      await waitFor(() => {
        expect(screen.queryByTestId("unread-badge")).not.toBeInTheDocument();
      });
    });

    it("reverts optimistic update when PATCH fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ notifications: twoNotifications, unreadCount: 1 }),
          })
          .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }),
      );
      render(<NotificationCenter />);
      const trigger = await screen.findByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId("mark-read-notif-1"));
      await waitFor(() => {
        expect(screen.getByTestId("mark-read-notif-1")).toBeInTheDocument();
      });
    });
  });

  describe("live SSE updates", () => {
    it("prepends new notification delivered via SSE", async () => {
      mockFetchSuccess([makeNotification({ id: "existing", read: true })]);
      render(<NotificationCenter />);
      await screen.findByRole("button", { name: /no unread/i });

      const newNotif = makeNotification({
        id: "new-notif",
        title: "New Alert",
        message: "Something happened.",
        read: false,
      });
      act(() => {
        capturedOnNotification?.(newNotif);
      });

      const trigger = screen.getByRole("button", { name: "1 unread notification" });
      fireEvent.click(trigger);
      expect(screen.getByText("New Alert")).toBeInTheDocument();
    });

    it("does not duplicate a notification already in the list", async () => {
      mockFetchSuccess([makeNotification({ id: "notif-1", read: false })]);
      render(<NotificationCenter />);
      await screen.findByRole("button", { name: /notification/i });

      act(() => {
        capturedOnNotification?.(makeNotification({ id: "notif-1", read: false }));
      });

      const trigger = screen.getByRole("button", { name: /notification/i });
      fireEvent.click(trigger);
      const items = screen.getAllByTestId(/notification-item-/);
      expect(items).toHaveLength(1);
    });

    it("updates aria-live region when new notification arrives", async () => {
      mockFetchSuccess([]);
      render(<NotificationCenter />);
      await screen.findByRole("button", { name: /no unread/i });

      act(() => {
        capturedOnNotification?.(makeNotification({ id: "live-1", title: "Live Update" }));
      });

      await waitFor(() => {
        expect(screen.getByTestId("live-region")).toHaveTextContent("New notification: Live Update");
      });
    });
  });
});
