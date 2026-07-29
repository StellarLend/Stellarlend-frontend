import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

function Test({ name, defaultValue }: { name: string; defaultValue: boolean }) {
  const on = useFeatureFlag(name, defaultValue);
  return <div data-testid="flag">{String(on)}</div>;
}

describe("useFeatureFlag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries after failure and updates when fetch succeeds", async () => {
    const mock = vi.mocked(fetch as any);

    mock.mockRejectedValueOnce(new Error("network"));

    mock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ feature_x: true }),
    });

    render(<Test name="feature_x" defaultValue={false} />);

    // initial state should use defaultValue when flags unavailable
    expect(screen.getByTestId("flag").textContent).toBe("false");

    // advance timers to let the hook retry after its TTL
    vi.advanceTimersByTime(30_000 + 10);

    await waitFor(() => {
      expect(screen.getByTestId("flag").textContent).toBe("true");
    });

    expect(mock).toHaveBeenCalledTimes(2);
  });
});
