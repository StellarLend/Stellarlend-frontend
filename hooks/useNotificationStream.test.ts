// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotificationStream } from "./useNotificationStream";

class MockEventSource {
  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }

  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  listeners = new Map<string, Set<EventListener>>();
  close = vi.fn();
  addEventListener = vi.fn((type: string, listener: EventListener) => {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  });
  removeEventListener = vi.fn((type: string, listener: EventListener) => {
    this.listeners.get(type)?.delete(listener);
  });

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  receiveMessage(data: unknown) {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(data) }),
    );
  }

  receiveRawMessage(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  receiveNamedEvent(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  receiveRawNamedEvent(type: string, data: string) {
    const event = new MessageEvent(type, { data });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  triggerError() {
    this.onerror?.(new Event("error"));
  }

  triggerOpen() {
    this.onopen?.(new Event("open"));
  }
}

describe("useNotificationStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.reset();
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("creates EventSource with correct URL on mount", () => {
    renderHook(() => useNotificationStream());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/notifications/stream");
  });

  it("updates unreadCount when valid message is received", () => {
    const { result } = renderHook(() => useNotificationStream());

    act(() => {
      MockEventSource.instances[0].receiveMessage({ unreadCount: 5 });
    });

    expect(result.current.unreadCount).toBe(5);
  });

  it("updates unreadCount from named unreadCount events", () => {
    const { result } = renderHook(() => useNotificationStream());

    act(() => {
      MockEventSource.instances[0].receiveNamedEvent("unreadCount", {
        unreadCount: 7,
      });
    });

    expect(result.current.unreadCount).toBe(7);
  });

  it("delivers named notification events to the notification callback", () => {
    const onNotification = vi.fn();
    renderHook(() => useNotificationStream({ onNotification }));

    const notification = {
      id: "notif-live",
      userId: "user-1",
      title: "Payment due",
      message: "Your loan payment is due soon.",
      read: false,
      createdAt: "2026-06-27T12:00:00.000Z",
      type: "warning",
    };

    act(() => {
      MockEventSource.instances[0].receiveNamedEvent(
        "notification",
        notification,
      );
    });

    expect(onNotification).toHaveBeenCalledWith(notification);
  });

  it("ignores malformed named notification events", () => {
    const onNotification = vi.fn();
    renderHook(() => useNotificationStream({ onNotification }));

    act(() => {
      MockEventSource.instances[0].receiveRawNamedEvent(
        "notification",
        "not-json",
      );
      MockEventSource.instances[0].receiveNamedEvent("notification", {
        id: "missing-fields",
      });
    });

    expect(onNotification).not.toHaveBeenCalled();
  });

  it("ignores malformed JSON without crashing", () => {
    const { result } = renderHook(() => useNotificationStream());

    act(() => {
      MockEventSource.instances[0].receiveRawMessage("not-valid-json");
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it("ignores non-numeric unreadCount payload", () => {
    const { result } = renderHook(() => useNotificationStream());

    act(() => {
      MockEventSource.instances[0].receiveMessage({ unreadCount: "abc" });
    });
    expect(result.current.unreadCount).toBe(0);

    act(() => {
      MockEventSource.instances[0].receiveMessage({ unreadCount: null });
    });
    expect(result.current.unreadCount).toBe(0);

    act(() => {
      MockEventSource.instances[0].receiveMessage({ unreadCount: undefined });
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it("closes source before scheduling reconnect on error", () => {
    renderHook(() => useNotificationStream());
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.triggerError();
    });

    expect(instance.close).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("reconnects with exponential backoff up to 30s cap", () => {
    renderHook(() => useNotificationStream());

    act(() => {
      MockEventSource.instances[0].triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    act(() => {
      MockEventSource.instances[1].triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(MockEventSource.instances).toHaveLength(3);

    act(() => {
      MockEventSource.instances[2].triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(MockEventSource.instances).toHaveLength(4);

    act(() => {
      MockEventSource.instances[3].triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(MockEventSource.instances).toHaveLength(5);

    act(() => {
      MockEventSource.instances[4].triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(16000);
    });
    expect(MockEventSource.instances).toHaveLength(6);

    act(() => {
      MockEventSource.instances[5].triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(MockEventSource.instances).toHaveLength(7);

    act(() => {
      MockEventSource.instances[6].triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(MockEventSource.instances).toHaveLength(8);
  });

  it("resets backoff to 1s after successful reconnect", () => {
    renderHook(() => useNotificationStream());

    act(() => {
      MockEventSource.instances[0].triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    act(() => {
      MockEventSource.instances[1].triggerOpen();
    });

    act(() => {
      MockEventSource.instances[1].triggerError();
    });

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockEventSource.instances).toHaveLength(3);
  });

  it("unmount closes EventSource and clears pending reconnect timer", () => {
    const { unmount } = renderHook(() => useNotificationStream());
    const instance = MockEventSource.instances[0];

    unmount();

    expect(instance.close).toHaveBeenCalledTimes(1);

    act(() => {
      vi.runAllTimers();
    });
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("does not create duplicate reconnect timers on multiple rapid errors", () => {
    renderHook(() => useNotificationStream());
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.triggerError();
      instance.triggerError();
      instance.triggerError();
    });

    expect(instance.close).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });
});
