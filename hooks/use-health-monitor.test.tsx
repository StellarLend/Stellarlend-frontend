import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as healthLib from "@/lib/health";
import { useHealthMonitor } from "./use-health-monitor";

vi.mock("@/lib/health", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/health")>();
  return { ...actual, getHealthFactor: vi.fn() };
});

const mockHealth = vi.mocked(healthLib.getHealthFactor);
const USER = "GTESTUSER";
const at = (n: number) => healthLib.decodeHealthFactor(BigInt(n));

const notified = vi.fn();
class FakeNotification {
  static permission: NotificationPermission = "granted";
  static requestPermission = vi.fn(
    async () => "granted" as NotificationPermission,
  );
  constructor(title: string, options?: NotificationOptions) {
    notified(title, options);
  }
}

function setVisibility(state: "visible" | "hidden", fire = true) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  if (fire) document.dispatchEvent(new Event("visibilitychange"));
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  mockHealth.mockReset();
  notified.mockClear();
  FakeNotification.permission = "granted";
  vi.stubGlobal("Notification", FakeNotification);
  setVisibility("visible", false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setVisibility("visible", false);
});

describe("useHealthMonitor polling", () => {
  it("polls on mount and then every 60 seconds", async () => {
    mockHealth.mockResolvedValue(at(20000));
    const { result } = renderHook(() => useHealthMonitor(USER));
    await tick(0);
    expect(mockHealth).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("ok");
    expect(result.current.level).toBe("safe");

    await tick(60_000);
    expect(mockHealth).toHaveBeenCalledTimes(2);
    await tick(60_000);
    expect(mockHealth).toHaveBeenCalledTimes(3);
  });

  it("pauses while the tab is hidden and resumes when visible", async () => {
    mockHealth.mockResolvedValue(at(20000));
    renderHook(() => useHealthMonitor(USER));
    await tick(0);
    expect(mockHealth).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    await tick(180_000);
    expect(mockHealth).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    await tick(0);
    expect(mockHealth).toHaveBeenCalledTimes(2);
  });

  it("backs off after errors", async () => {
    mockHealth.mockRejectedValue(new Error("rpc down"));
    const { result } = renderHook(() => useHealthMonitor(USER));
    await tick(0);
    expect(mockHealth).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");

    await tick(60_000); // normal interval has passed, but backoff is 120s
    expect(mockHealth).toHaveBeenCalledTimes(1);
    await tick(60_000);
    expect(mockHealth).toHaveBeenCalledTimes(2);
  });
});

describe("useHealthMonitor notifications", () => {
  it("notifies once per worsening crossing and again after recovery", async () => {
    healthLib.setNotifyEnabled(true);
    mockHealth
      .mockResolvedValueOnce(at(20000)) // safe
      .mockResolvedValueOnce(at(14000)) // -> warning
      .mockResolvedValueOnce(at(14000)) // still warning
      .mockResolvedValueOnce(at(20000)) // recovered
      .mockResolvedValueOnce(at(14000)); // -> warning again

    renderHook(() => useHealthMonitor(USER));
    await tick(0);
    expect(notified).not.toHaveBeenCalled();

    await tick(60_000);
    expect(notified).toHaveBeenCalledTimes(1);
    await tick(60_000);
    expect(notified).toHaveBeenCalledTimes(1);
    await tick(60_000);
    expect(notified).toHaveBeenCalledTimes(1);
    await tick(60_000);
    expect(notified).toHaveBeenCalledTimes(2);
  });

  it("does not notify when the user has not opted in", async () => {
    mockHealth
      .mockResolvedValueOnce(at(20000))
      .mockResolvedValueOnce(at(14000));
    renderHook(() => useHealthMonitor(USER));
    await tick(0);
    await tick(60_000);
    expect(notified).not.toHaveBeenCalled();
  });

  it("does not notify when permission is denied", async () => {
    FakeNotification.permission = "denied";
    healthLib.setNotifyEnabled(true);
    mockHealth
      .mockResolvedValueOnce(at(20000))
      .mockResolvedValueOnce(at(14000));
    renderHook(() => useHealthMonitor(USER));
    await tick(0);
    await tick(60_000);
    expect(notified).not.toHaveBeenCalled();
  });

  it("does not duplicate when another tab already recorded the level", async () => {
    healthLib.setNotifyEnabled(true);
    healthLib.writeLastLevel(USER, "warning"); // another tab got there first
    mockHealth.mockResolvedValue(at(14000));
    renderHook(() => useHealthMonitor(USER));
    await tick(0);
    expect(notified).not.toHaveBeenCalled();
  });
});