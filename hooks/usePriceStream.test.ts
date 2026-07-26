// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@/test/test-utils";
import { usePriceStream } from "./usePriceStream";

class MockEventSource {
  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }

  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  close = vi.fn();

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

  triggerError() {
    this.onerror?.(new Event("error"));
  }

  triggerOpen() {
    this.onopen?.(new Event("open"));
  }
}

describe("usePriceStream", () => {
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
    renderHook(() => usePriceStream());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/stream/prices");
  });

  it("sets isLoading to false after receiving price events", () => {
    const { result } = renderHook(() => usePriceStream());

    expect(result.current.isLoading).toBe(true);

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "XLM",
        price: 0.12,
        timestamp: "2026-06-28T10:00:00.000Z",
      });
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("receives price events and updates prices map", () => {
    const { result } = renderHook(() => usePriceStream());

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "XLM",
        price: 0.1245,
        timestamp: "2026-06-28T10:00:00.000Z",
      });
    });

    expect(result.current.prices.size).toBe(1);
    expect(result.current.prices.get("XLM")).toEqual({
      symbol: "XLM",
      price: 0.1245,
      timestamp: "2026-06-28T10:00:00.000Z",
      direction: "unchanged",
    });
  });

  it("updates direction to up when price increases", () => {
    const { result } = renderHook(() => usePriceStream());

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "BTC",
        price: 67000,
        timestamp: "2026-06-28T10:00:00.000Z",
      });
    });

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "BTC",
        price: 68000,
        timestamp: "2026-06-28T10:01:00.000Z",
      });
    });

    expect(result.current.prices.get("BTC")?.direction).toBe("up");
  });

  it("updates direction to down when price decreases", () => {
    const { result } = renderHook(() => usePriceStream());

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "ETH",
        price: 3500,
        timestamp: "2026-06-28T10:00:00.000Z",
      });
    });

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "ETH",
        price: 3400,
        timestamp: "2026-06-28T10:01:00.000Z",
      });
    });

    expect(result.current.prices.get("ETH")?.direction).toBe("down");
  });

  it("keeps direction unchanged when price stays same", () => {
    const { result } = renderHook(() => usePriceStream());

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "USDC",
        price: 1.0,
        timestamp: "2026-06-28T10:00:00.000Z",
      });
    });

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "USDC",
        price: 1.0,
        timestamp: "2026-06-28T10:01:00.000Z",
      });
    });

    expect(result.current.prices.get("USDC")?.direction).toBe("unchanged");
  });

  it("ignores malformed JSON without crashing", () => {
    const { result } = renderHook(() => usePriceStream());

    act(() => {
      MockEventSource.instances[0].receiveRawMessage("not-valid-json");
    });

    expect(result.current.prices.size).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });

  it("ignores malformed event payload without crashing", () => {
    const { result } = renderHook(() => usePriceStream());

    act(() => {
      MockEventSource.instances[0].receiveMessage({ symbol: "XLM" });
      MockEventSource.instances[0].receiveMessage({ price: 100 });
      MockEventSource.instances[0].receiveMessage({
        symbol: "XLM",
        price: "not-a-number",
        timestamp: "2026-06-28T10:00:00.000Z",
      });
      MockEventSource.instances[0].receiveMessage({
        symbol: "XLM",
        price: 100,
        timestamp: 123,
      });
    });

    expect(result.current.prices.size).toBe(0);
  });

  it("reconnects after stream error", () => {
    renderHook(() => usePriceStream());

    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      MockEventSource.instances[0].triggerError();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("reconnects with exponential backoff up to 30s cap", () => {
    renderHook(() => usePriceStream());

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

  it("resets backoff to 1s after successful reconnect (onopen)", () => {
    renderHook(() => usePriceStream());

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

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => usePriceStream());
    const instance = MockEventSource.instances[0];

    unmount();

    expect(instance.close).toHaveBeenCalledTimes(1);
  });

  it("clears pending reconnect timer on unmount", () => {
    const { unmount } = renderHook(() => usePriceStream());

    unmount();

    act(() => {
      vi.runAllTimers();
    });

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("does not create duplicate subscriptions on rapid re-renders", () => {
    renderHook(() => usePriceStream());

    act(() => {
      MockEventSource.instances[0].triggerError();
      MockEventSource.instances[0].triggerError();
      MockEventSource.instances[0].triggerError();
    });

    expect(MockEventSource.instances[0].close).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("calls onPrice callback with updated prices", () => {
    const onPrice = vi.fn();
    renderHook(() => usePriceStream({ onPrice }));

    act(() => {
      MockEventSource.instances[0].receiveMessage({
        symbol: "XLM",
        price: 0.12,
        timestamp: "2026-06-28T10:00:00.000Z",
      });
    });

    expect(onPrice).toHaveBeenCalledTimes(1);
    expect(onPrice).toHaveBeenCalledWith(
      expect.any(Map),
    );
  });

  it("initially returns empty prices map", () => {
    const { result } = renderHook(() => usePriceStream());

    expect(result.current.prices.size).toBe(0);
  });
});