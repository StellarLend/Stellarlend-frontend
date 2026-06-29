import React from "react";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("FeatureGate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders children when the flag is enabled", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ priceTicker: true }),
    } as Response);

    const { FeatureGate } = await import("./FeatureGate");
    render(
      <FeatureGate flag="priceTicker">
        <span data-testid="content">New Price Ticker</span>
      </FeatureGate>,
    );

    expect(await screen.findByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("New Price Ticker")).toBeInTheDocument();
  });

  it("does not render children when the flag is disabled", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ priceTicker: false }),
    } as Response);

    const { FeatureGate } = await import("./FeatureGate");
    render(
      <FeatureGate flag="priceTicker">
        <span data-testid="content">New Price Ticker</span>
      </FeatureGate>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });
  });

  it("renders fallback when the flag is disabled and fallback is provided", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ priceTicker: false }),
    } as Response);

    const { FeatureGate } = await import("./FeatureGate");
    render(
      <FeatureGate
        flag="priceTicker"
        fallback={<span data-testid="fallback">Coming Soon</span>}
      >
        <span data-testid="content">New Price Ticker</span>
      </FeatureGate>,
    );

    expect(await screen.findByTestId("fallback")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("renders nothing when flag is disabled and no fallback", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ priceTicker: false }),
    } as Response);

    const { FeatureGate } = await import("./FeatureGate");
    const { container } = render(
      <FeatureGate flag="priceTicker">
        <span data-testid="content">New Price Ticker</span>
      </FeatureGate>,
    );

    await waitFor(() => {
      expect(container.textContent).toBe("");
    });
  });

  it("defaults to off when fetch fails", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const { FeatureGate } = await import("./FeatureGate");
    render(
      <FeatureGate
        flag="priceTicker"
        fallback={<span data-testid="fallback">Offline</span>}
      >
        <span data-testid="content">New Price Ticker</span>
      </FeatureGate>,
    );

    expect(await screen.findByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });
});
