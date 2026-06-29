import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LiquidationsPanel, {
  getDistanceToLiquidationPercent,
} from "./LiquidationsPanel";
import type { LiquidationPosition } from "@/lib/positions/liquidation";

const position = (
  overrides: Partial<LiquidationPosition>,
): LiquidationPosition => ({
  asset: "XLM",
  borrowedAmount: 100,
  collateralAsset: "XLM",
  collateralAmount: 200,
  collateralFactor: 0.8,
  healthFactor: 1.6,
  liquidationPriceFactor: 0.63,
  riskScore: 0.4,
  ...overrides,
});

const alertIdFor = (item: LiquidationPosition, index = 0): string =>
  [
    item.asset,
    item.collateralAsset,
    item.borrowedAmount,
    item.collateralAmount,
    index,
  ].join(":");

function preferenceFetcher(
  subscriptions: string[] = [],
  persistOk = true,
): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.startsWith("/api/account/notification-preferences")) {
      if (init?.method === "PUT") {
        return {
          ok: persistOk,
          json: async () => ({}),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ subscriptions }),
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({ positions: [] }),
    } as Response;
  }) as typeof fetch;
}

function renderPanel(
  positions: LiquidationPosition[],
  fetcher = preferenceFetcher(),
) {
  return render(
    <LiquidationsPanel initialPositions={positions} fetcher={fetcher} />,
  );
}

describe("LiquidationsPanel", () => {
  it("renders liquidation price and distance columns from API outputs", () => {
    renderPanel([
      position({
        asset: "USDC",
        borrowedAmount: 250,
        collateralAsset: "XLM",
        collateralAmount: 500,
        healthFactor: 1.25,
        liquidationPriceFactor: 0.5,
      }),
    ]);

    expect(
      screen.getByRole("heading", { name: "Liquidation Risk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Liquidation price" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Distance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0.50x")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
  });

  it("sorts by distance ascending while preserving stable order for ties", () => {
    renderPanel([
      position({
        asset: "XLM",
        healthFactor: 1.2,
        liquidationPriceFactor: 0.7,
      }),
      position({
        asset: "USDC",
        healthFactor: 0.95,
        liquidationPriceFactor: 1.05,
      }),
      position({
        asset: "ETH",
        healthFactor: 1.2,
        liquidationPriceFactor: 0.7,
      }),
      position({
        asset: "BTC",
        healthFactor: Number.POSITIVE_INFINITY,
        liquidationPriceFactor: 0,
      }),
    ]);

    const rows = screen.getAllByRole("row").slice(1);

    expect(within(rows[0]).getByText("100 USDC")).toBeInTheDocument();
    expect(within(rows[1]).getByText("100 XLM")).toBeInTheDocument();
    expect(within(rows[2]).getByText("100 ETH")).toBeInTheDocument();
    expect(within(rows[3]).getByText("100 BTC")).toBeInTheDocument();
  });

  it("shows color-safe text labels for near and past liquidation rows", () => {
    renderPanel([
      position({
        asset: "USDC",
        healthFactor: 0.9,
        liquidationPriceFactor: 1.11,
      }),
      position({
        asset: "XLM",
        healthFactor: 1.08,
        liquidationPriceFactor: 0.93,
      }),
      position({
        asset: "ETH",
        healthFactor: 1.2,
        liquidationPriceFactor: 0.83,
      }),
    ]);

    expect(screen.getByText("Past liquidation")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("places missing price and distance data after measurable positions", () => {
    renderPanel([
      position({
        asset: "BTC",
        healthFactor: Number.POSITIVE_INFINITY,
        liquidationPriceFactor: 0,
      }),
      position({
        asset: "XLM",
        healthFactor: 1.1,
        liquidationPriceFactor: 0.91,
      }),
    ]);

    const rows = screen.getAllByRole("row").slice(1);

    expect(within(rows[0]).getByText("100 XLM")).toBeInTheDocument();
    expect(within(rows[1]).getByText("100 BTC")).toBeInTheDocument();
    expect(within(rows[1]).getAllByText("N/A")).toHaveLength(2);
    expect(within(rows[1]).getAllByText("Unavailable")).toHaveLength(2);
  });

  it("returns null distance for positions without a finite health factor", () => {
    expect(
      getDistanceToLiquidationPercent({
        healthFactor: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
  });

  it("reflects the current liquidation alert subscription state on load", async () => {
    const item = position({ asset: "USDC" });
    renderPanel([item], preferenceFetcher([alertIdFor(item)]));

    const toggle = await screen.findByRole("switch", {
      name: /disable liquidation alerts/i,
    });

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveTextContent("On");
  });

  it("optimistically enables and disables liquidation alerts", async () => {
    const user = userEvent.setup();
    const fetcher = preferenceFetcher();

    renderPanel([position({ asset: "USDC" })], fetcher);

    const toggle = await screen.findByRole("switch", {
      name: /enable liquidation alerts/i,
    });

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/account/notification-preferences",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"enabled":true'),
      }),
    );

    await waitFor(() => expect(toggle).not.toBeDisabled());
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/account/notification-preferences",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"enabled":false'),
      }),
    );
  });

  it("rolls optimistic changes back when persistence fails", async () => {
    const user = userEvent.setup();

    renderPanel([position({ asset: "USDC" })], preferenceFetcher([], false));

    const toggle = await screen.findByRole("switch", {
      name: /enable liquidation alerts/i,
    });

    await user.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });
    expect(
      screen.getByText("Unable to save alert preference"),
    ).toHaveTextContent("Unable to save alert preference");
  });

  it("does not load alert preferences when there are no at-risk rows", () => {
    const fetcher = preferenceFetcher();

    renderPanel([], fetcher);

    expect(
      screen.getByText("No liquidation risk positions found."),
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
