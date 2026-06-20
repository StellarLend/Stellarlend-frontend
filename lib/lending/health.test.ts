import { describe, expect, it } from "vitest";
import {
  calculateProjectedBorrowHealth,
  getHealthBand,
} from "@/lib/lending/health";

const prices = {
  USDC: 1,
  XLM: 0.12,
  ETH: 3500,
};

describe("lending health preview", () => {
  it("calculates projected health factor and liquidation price", () => {
    const preview = calculateProjectedBorrowHealth({
      loanAmount: 100,
      borrowAsset: "USDC",
      collateralAmount: 300,
      collateralAsset: "USDC",
      prices,
    });

    expect(preview).toEqual(
      expect.objectContaining({
        healthFactor: 2.5,
        liquidationPrice: 0.4,
        loanValueUsd: 100,
        collateralValueUsd: 300,
      }),
    );
  });

  it("returns no preview when inputs or prices are missing", () => {
    expect(
      calculateProjectedBorrowHealth({
        loanAmount: 0,
        borrowAsset: "USDC",
        collateralAmount: 300,
        collateralAsset: "USDC",
        prices,
      }),
    ).toBeNull();

    expect(
      calculateProjectedBorrowHealth({
        loanAmount: 100,
        borrowAsset: "BTC",
        collateralAmount: 300,
        collateralAsset: "USDC",
        prices,
      }),
    ).toBeNull();
  });

  it("maps health bands to the PositionSummary thresholds", () => {
    expect(getHealthBand(2)).toBe("healthy");
    expect(getHealthBand(1.5)).toBe("at-risk");
    expect(getHealthBand(0.99)).toBe("critical");
  });
});
