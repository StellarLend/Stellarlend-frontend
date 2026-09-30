import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import NotificationBell from "./NotificationBell";

const meta: Meta<typeof NotificationBell> = {
  title: "Shared/Layout/NotificationBell",
  component: NotificationBell,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof NotificationBell>;

//
// Visual / static stories
//

export const Default: Story = {};

//
// Interactive notification widget used by play stories
//

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

const defaultNotifications: NotificationItem[] = [
  { id: "1", title: "Loan Approved", message: "Your 500 USDC loan was approved.", read: false },
  { id: "2", title: "Payment Received", message: "100 XLM received.", read: false },
  { id: "3", title: "Rate Update", message: "Lending rates have changed.", read: false },
];

function NotificationWidget({
  onMarkRead,
  onToggle,
  startOpen = false,
  notifications: initialNotifications = defaultNotifications,
}: {
  onMarkRead?: (id: string) => void;
  onToggle?: (open: boolean) => void;
  startOpen?: boolean;
  notifications?: NotificationItem[];
}) {
  const [isOpen, setIsOpen] = useState(startOpen);
  const [notifications, setNotifications] = useState(initialNotifications);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      onToggle?.(next);
      return next;
    });
  }, [onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        onToggle?.(false);
        triggerRef.current?.focus();
      }
    },
    [onToggle],
  );

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);
  const showBadge = unreadCount > 0;

  const handleMarkRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      onMarkRead?.(id);
    },
    [onMarkRead],
  );

  return (
    <div style={{ display: "inline-block", position: "relative", fontFamily: "system-ui, sans-serif" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        aria-label={
          showBadge
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "No unread notifications"
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 6,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "#374151",
        }}
        className="hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            d="M22 20H2V18H3V11.0314C3 6.04348 7.02944 2 12 2C16.9706 2 21 6.04348 21 11.0314V18H22V20ZM9.5 21H14.5C14.5 22.3807 13.3807 23.5 12 23.5C10.6193 23.5 9.5 22.3807 9.5 21Z"
            fill="currentColor"
          />
        </svg>
        {showBadge && (
          <span
            data-testid="unread-badge"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              backgroundColor: "#dc2626",
              color: "white",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {displayCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications panel"
          onKeyDown={handleKeyDown}
          data-testid="notification-panel"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            width: 360,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            border: "1px solid #e2e8f0",
            zIndex: 50,
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }}>
            Notifications
          </div>

          {notifications.length === 0 ? (
            <p data-testid="empty-state" style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14, margin: 0 }}>
              No notifications yet
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  data-testid={`notification-item-${n.id}`}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f1f5f9",
                    background: n.read ? "transparent" : "#f8fafc",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0", lineHeight: 1.4 }}>{n.message}</p>
                  {!n.read && (
                    <button
                      type="button"
                      data-testid={`mark-read-${n.id}`}
                      onClick={() => handleMarkRead(n.id)}
                      style={{
                        marginTop: 8,
                        padding: "4px 12px",
                        fontSize: 12,
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        background: "#fff",
                        cursor: "pointer",
                        color: "#374151",
                      }}
                    >
                      Mark as read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

//
// Play: Open panel via mouse click
//

export const OpenPanelClick: StoryObj = {
  name: "Play: Open panel via click",
  render: () => <NotificationWidget />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = canvas.getByRole("button", { name: /unread notifications/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(canvas.getByTestId("notification-panel")).toBeInTheDocument();
    });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  },
};

//
// Play: Open panel via keyboard (Enter)
//

export const OpenPanelKeyboard: StoryObj = {
  name: "Play: Open panel via keyboard (Enter)",
  render: () => <NotificationWidget />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = canvas.getByRole("button", { name: /unread notifications/i });
    trigger.focus();
    expect(trigger).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(canvas.getByTestId("notification-panel")).toBeInTheDocument();
    });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  },
};

//
// Play: Mark as read updates the unread badge
//

export const MarkAsRead: StoryObj = {
  name: "Play: Mark as read updates badge",
  render: () => <NotificationWidget />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = canvas.getByRole("button", { name: /3 unread notifications/i });
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.getByTestId("notification-panel")).toBeInTheDocument();
    });

    const markReadBtn = canvas.getByTestId("mark-read-1");
    await userEvent.click(markReadBtn);

    await waitFor(() => {
      const badge = canvas.queryByTestId("unread-badge");
      if (badge) {
        expect(badge).toHaveTextContent("2");
      }
    });

    const updatedTrigger = canvas.getByRole("button", { name: /2 unread notifications/i });
    expect(updatedTrigger).toBeInTheDocument();
  },
};

//
// Play: Escape closes panel and restores focus
//

export const EscapeClosesPanel: StoryObj = {
  name: "Play: Escape closes panel and restores focus",
  render: () => <NotificationWidget />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = canvas.getByRole("button", { name: /unread notifications/i });
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.getByTestId("notification-panel")).toBeInTheDocument();
    });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(canvas.queryByTestId("notification-panel")).not.toBeInTheDocument();
    });

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  },
};

//
// Play: Empty notifications state
//

export const EmptyNotifications: StoryObj = {
  name: "Play: Empty notifications state",
  render: () => <NotificationWidget notifications={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = canvas.getByRole("button", { name: /no unread notifications/i });
    expect(canvas.queryByTestId("unread-badge")).not.toBeInTheDocument();

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(canvas.getByTestId("notification-panel")).toBeInTheDocument();
    });

    expect(canvas.getByTestId("empty-state")).toHaveTextContent("No notifications yet");
  },
};
