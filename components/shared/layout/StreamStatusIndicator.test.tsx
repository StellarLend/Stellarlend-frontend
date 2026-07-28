import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import StreamStatusIndicator from "./StreamStatusIndicator";

describe("StreamStatusIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an accessible connected status", () => {
    render(<StreamStatusIndicator connectionState="connected" />);

    expect(
      screen.getByRole("button", { name: "Notification stream status: Live" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders reconnecting status with visible text not just color", () => {
    render(<StreamStatusIndicator connectionState="reconnecting" />);

    expect(
      screen.getByRole("button", { name: "Notification stream status: Reconnecting" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
  });

  it("shows a tooltip explaining the current state", async () => {
    render(<StreamStatusIndicator connectionState="offline" />);

    const indicator = screen.getByRole("button", {
      name: "Notification stream status: Offline",
    });

    fireEvent.mouseEnter(indicator);
    vi.advanceTimersByTime(300);

    expect(
      await screen.findByText(
        "Live notifications are offline. New alerts will appear after the connection is restored.",
      ),
    ).toBeInTheDocument();
  });
});
