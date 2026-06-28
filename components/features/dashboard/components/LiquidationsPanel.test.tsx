import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("LiquidationsPanel", () => {
  it("renders liquidation price and distance columns from API outputs", () => {
    render(
      <LiquidationsPanel
        initialPositions={[
          position({
            asset: "USDC",
            borrowedAmount: 250,
            collateralAsset: "XLM",
            collateralAmount: 500,
            healthFactor: 1.25,
            liquidationPriceFactor: 0.5,
          }),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Liquidation Risk" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Liquidation price" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Distance" })).toBeInTheDocument();
    expect(screen.getByText("0.50x")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
  });

  it("sorts by distance ascending while preserving stable order for ties", () => {
    render(
      <LiquidationsPanel
        initialPositions={[
          position({ asset: "XLM", healthFactor: 1.2, liquidationPriceFactor: 0.7 }),
          position({ asset: "USDC", healthFactor: 0.95, liquidationPriceFactor: 1.05 }),
          position({ asset: "ETH", healthFactor: 1.2, liquidationPriceFactor: 0.7 }),
          position({
            asset: "BTC",
            healthFactor: Number.POSITIVE_INFINITY,
            liquidationPriceFactor: 0,
          }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);

    expect(within(rows[0]).getByText("100 USDC")).toBeInTheDocument();
    expect(within(rows[1]).getByText("100 XLM")).toBeInTheDocument();
    expect(within(rows[2]).getByText("100 ETH")).toBeInTheDocument();
    expect(within(rows[3]).getByText("100 BTC")).toBeInTheDocument();
  });

  it("shows color-safe text labels for near and past liquidation rows", () => {
    render(
      <LiquidationsPanel
        initialPositions={[
          position({ asset: "USDC", healthFactor: 0.9, liquidationPriceFactor: 1.11 }),
          position({ asset: "XLM", healthFactor: 1.08, liquidationPriceFactor: 0.93 }),
          position({ asset: "ETH", healthFactor: 1.2, liquidationPriceFactor: 0.83 }),
        ]}
      />,
    );

    expect(screen.getByText("Past liquidation")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("places missing price and distance data after measurable positions", () => {
    render(
      <LiquidationsPanel
        initialPositions={[
          position({
            asset: "BTC",
            healthFactor: Number.POSITIVE_INFINITY,
            liquidationPriceFactor: 0,
          }),
          position({ asset: "XLM", healthFactor: 1.1, liquidationPriceFactor: 0.91 }),
        ]}
      />,
    );

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
});
