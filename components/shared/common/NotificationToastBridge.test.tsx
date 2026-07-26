import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "@/lib/notifications/types";
import { ToastProvider } from "./Toast";
import NotificationToastBridge from "./NotificationToastBridge";

const { reducedMotionFn, streamFn, streamSubscribers } = vi.hoisted(() => ({
  reducedMotionFn: vi.fn(() => false),
  streamFn: vi.fn(),
  streamSubscribers: new Set<(notification: Notification) => void>(),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: reducedMotionFn,
}));

vi.mock("@/hooks/useNotificationStream", async () => {
  const ReactActual = await vi.importActual<typeof import("react")>("react");

  return {
    default: (options?: {
      onNotification?: (notification: Notification) => void;
    }) => {
      streamFn(options);

      ReactActual.useEffect(() => {
        if (!options?.onNotification) {
          return;
        }

        streamSubscribers.add(options.onNotification);
        return () => {
          streamSubscribers.delete(options.onNotification);
        };
      }, [options?.onNotification]);

      return { unreadCount: 0 };
    },
    useNotificationStream: (options?: {
      onNotification?: (notification: Notification) => void;
    }) => {
      streamFn(options);

      ReactActual.useEffect(() => {
        if (!options?.onNotification) {
          return;
        }

        streamSubscribers.add(options.onNotification);
        return () => {
          streamSubscribers.delete(options.onNotification);
        };
      }, [options?.onNotification]);

      return { unreadCount: 0 };
    },
  };
});

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notif-1",
    userId: "user-1",
    title: "Loan payment due",
    message: "Your USDC loan payment is due soon.",
    read: false,
    createdAt: "2026-06-27T12:00:00.000Z",
    type: "warning",
    ...overrides,
  };
}

function renderBridge(
  props: Partial<React.ComponentProps<typeof NotificationToastBridge>> = {},
) {
  return render(
    <ToastProvider defaultDurationMs={10_000}>
      <NotificationToastBridge fetchInitialNotifications={false} {...props} />
    </ToastProvider>,
  );
}

function emitNotification(payload: Notification) {
  act(() => {
    for (const subscriber of streamSubscribers) {
      subscriber(payload);
    }
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

describe("NotificationToastBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reducedMotionFn.mockReturnValue(false);
    streamFn.mockClear();
    streamSubscribers.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
    streamSubscribers.clear();
  });

  it("toasts one qualifying notification and ignores the same id across reconnects", () => {
    renderBridge();

    emitNotification(notification({ id: "payment-warning" }));
    emitNotification(notification({ id: "payment-warning" }));

    expect(screen.getAllByText("Loan payment due")).toHaveLength(1);
    expect(
      screen.getByText("Your USDC loan payment is due soon."),
    ).toBeInTheDocument();
  });

  it("filters notifications below the configured priority threshold", () => {
    renderBridge({ priorityThreshold: "error" });

    emitNotification(notification({ id: "warning-1", type: "warning" }));
    expect(screen.queryByText("Loan payment due")).not.toBeInTheDocument();

    emitNotification(
      notification({
        id: "error-1",
        type: "error",
        title: "Liquidation risk",
        message: "Your position needs attention.",
      }),
    );

    expect(screen.getByText("Liquidation risk")).toBeInTheDocument();
    expect(
      screen.getByText("Your position needs attention."),
    ).toBeInTheDocument();
  });

  it("ignores read notifications even when they meet the priority threshold", () => {
    renderBridge();

    emitNotification(
      notification({ id: "read-error", type: "error", read: true }),
    );

    expect(screen.queryByText("Loan payment due")).not.toBeInTheDocument();
  });

  it("evicts old seen ids when the bounded seen set reaches its limit", () => {
    renderBridge({ seenLimit: 1 });

    emitNotification(
      notification({
        id: "seen-a",
        title: "First warning",
        message: "First pass.",
      }),
    );
    emitNotification(
      notification({
        id: "seen-b",
        title: "Second warning",
        message: "Second pass.",
      }),
    );
    emitNotification(
      notification({
        id: "seen-a",
        title: "First warning",
        message: "Seen again after eviction.",
      }),
    );

    expect(screen.getByText("Seen again after eviction.")).toBeInTheDocument();
  });

  it("seeds seen ids from unread notifications so refreshes do not re-toast old items", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [notification({ id: "already-unread" })],
      }),
    }) as unknown as typeof fetch;

    render(
      <ToastProvider defaultDurationMs={10_000}>
        <NotificationToastBridge />
      </ToastProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ credentials: "same-origin" }),
    );

    emitNotification(notification({ id: "already-unread" }));
    expect(screen.queryByText("Loan payment due")).not.toBeInTheDocument();

    emitNotification(notification({ id: "new-warning", title: "New warning" }));
    expect(screen.getByText("New warning")).toBeInTheDocument();
  });

  it("handles duplicate ids in the unread-store seed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          notification({ id: "duplicate-unread" }),
          notification({ id: "duplicate-unread" }),
        ],
      }),
    }) as unknown as typeof fetch;

    render(
      <ToastProvider defaultDurationMs={10_000}>
        <NotificationToastBridge />
      </ToastProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    emitNotification(notification({ id: "duplicate-unread" }));
    expect(screen.queryByText("Loan payment due")).not.toBeInTheDocument();
  });

  it("continues when the unread-store response has no notifications array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    render(
      <ToastProvider defaultDurationMs={10_000}>
        <NotificationToastBridge />
      </ToastProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    emitNotification(notification({ id: "after-empty-store" }));
    expect(screen.getByText("Loan payment due")).toBeInTheDocument();
  });

  it("queues live notifications while unread-store seeding is pending", async () => {
    const pendingFetch = deferred<Response>();
    global.fetch = vi
      .fn()
      .mockReturnValue(pendingFetch.promise) as unknown as typeof fetch;

    render(
      <ToastProvider defaultDurationMs={10_000}>
        <NotificationToastBridge />
      </ToastProvider>,
    );

    emitNotification(notification({ id: "queued-warning" }));
    expect(screen.queryByText("Loan payment due")).not.toBeInTheDocument();

    await act(async () => {
      pendingFetch.resolve({
        ok: true,
        json: async () => ({ notifications: [] }),
      } as Response);
      await pendingFetch.promise;
      await Promise.resolve();
    });

    expect(screen.getByText("Loan payment due")).toBeInTheDocument();
  });

  it("flushes queued notifications when unread-store seeding fails", async () => {
    const pendingFetch = deferred<Response>();
    global.fetch = vi
      .fn()
      .mockReturnValue(pendingFetch.promise) as unknown as typeof fetch;

    render(
      <ToastProvider defaultDurationMs={10_000}>
        <NotificationToastBridge />
      </ToastProvider>,
    );

    emitNotification(notification({ id: "queued-after-failure" }));

    await act(async () => {
      pendingFetch.resolve({
        ok: false,
        json: async () => ({ notifications: [] }),
      } as Response);
      await pendingFetch.promise;
      await Promise.resolve();
    });

    expect(screen.getByText("Loan payment due")).toBeInTheDocument();
  });

  it("omits toast entrance animation when reduced motion is enabled", () => {
    reducedMotionFn.mockReturnValue(true);
    renderBridge();

    emitNotification(notification({ id: "reduced-motion" }));

    expect(screen.getByRole("status")).not.toHaveClass("toast-enter");
  });

  it("cleans up the stream subscription on unmount", () => {
    const { unmount } = renderBridge();

    expect(streamSubscribers.size).toBe(1);

    unmount();

    expect(streamSubscribers.size).toBe(0);
  });
});
