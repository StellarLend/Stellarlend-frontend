import { describe, expect, it } from "vitest";
import {
  getCollateralConfig,
  getCollateralFactor,
  getLiquidationThreshold,
  isAssetSymbol,
} from "./registry";

describe("lib/markets/registry", () => {
  it("returns collateral config for known assets", () => {
    expect(getCollateralConfig("XLM")).toEqual({
      collateralFactor: 0.75,
      liquidationThreshold: 0.8,
    });
  });

  it("exposes factor helpers", () => {
    expect(getCollateralFactor("USDC")).toBe(0.85);
    expect(getLiquidationThreshold("BTC")).toBe(0.85);
  });

  it("validates asset symbols", () => {
    expect(isAssetSymbol("ETH")).toBe(true);
    expect(isAssetSymbol("DOGE")).toBe(false);
  });
});
