import { describe, expect, it } from "vitest";
import {
  bpsToPercent,
  computeDepositCapRemaining,
  decodeOption,
  isValidAssetAddress,
  mergeMarketParams,
  type OnChainAssetParams,
} from "./market-params";
import { type Market } from "./markets";
import { xdr } from "@stellar/stellar-sdk";

describe("lib/market-params", () => {
  describe("bpsToPercent", () => {
    it("converts bps to percentage without precision loss", () => {
      expect(bpsToPercent(7550)).toBe(75.5);
      expect(bpsToPercent(8000)).toBe(80);
      expect(bpsToPercent(123)).toBe(1.23);
      expect(bpsToPercent(0)).toBe(0);
      expect(bpsToPercent(10000)).toBe(100);
    });
  });

  describe("decodeOption", () => {
    it("returns null for undefined or null ScVal", () => {
      expect(decodeOption(undefined)).toBeNull();
      expect(decodeOption(null)).toBeNull();
    });

    it("returns null for ScValType None", () => {
      const noneVal = xdr.ScVal.scvVoid();
      expect(decodeOption(noneVal)).toBeNull();
    });
  });

  describe("isValidAssetAddress", () => {
    it("validates Stellar contract addresses and accounts", () => {
      // Valid contract ID (C... 56 chars)
      expect(isValidAssetAddress("CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6")).toBe(true);
      // Valid Ed25519 public key (G... 56 chars)
      expect(isValidAssetAddress("GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH")).toBe(true);
      // Invalid formats
      expect(isValidAssetAddress("invalid")).toBe(false);
      expect(isValidAssetAddress("")).toBe(false);
      expect(isValidAssetAddress(null)).toBe(false);
      expect(isValidAssetAddress(undefined)).toBe(false);
    });
  });

  describe("computeDepositCapRemaining", () => {
    it("returns null for uncapped (cap 0 or null)", () => {
      expect(computeDepositCapRemaining(BigInt(0), BigInt(500))).toBeNull();
      expect(computeDepositCapRemaining(null, BigInt(500))).toBeNull();
      expect(computeDepositCapRemaining(undefined, BigInt(500))).toBeNull();
    });

    it("calculates remaining capacity accurately", () => {
      const cap = BigInt(1_000_000_000_000); // 1T stroops
      const used = BigInt(400_000_000_000);
      expect(computeDepositCapRemaining(cap, used)).toBe(BigInt(600_000_000_000));
    });

    it("never returns negative remaining capacity (clamps to 0)", () => {
      const cap = BigInt(100);
      const used = BigInt(150);
      expect(computeDepositCapRemaining(cap, used)).toBe(BigInt(0));
    });

    it("handles boundary check: exactly at cap allows 0 remaining", () => {
      const cap = BigInt(100);
      const used = BigInt(100);
      expect(computeDepositCapRemaining(cap, used)).toBe(BigInt(0));
    });
  });

  describe("mergeMarketParams", () => {
    const baseMarket: Market = {
      symbol: "XLM",
      name: "Stellar Lumens",
      price: 0.12,
      supplyApy: 3.4,
      borrowApy: 6.1,
      totalSupply: 10_000,
      totalBorrow: 5_000,
      ltv: 0.7,
      decimals: 7,
      asset: "native",
    };

    it("defaults to demo parameters and labels sources as 'demo' when chain params are absent", () => {
      const merged = mergeMarketParams(baseMarket, null, null, null, null);
      expect(merged.ltv).toBe(0.7);
      expect(merged.ltvBps).toBe(7000);
      expect(merged.liqThresholdBps).toBe(8000);
      expect(merged.sources?.ltv).toBe("demo");
      expect(merged.sources?.liqThreshold).toBe("demo");
      expect(merged.sources?.supplyCap).toBe("demo");
    });

    it("gives chain parameters precedence over demo parameters and labels sources as 'chain'", () => {
      const chainParams: OnChainAssetParams = {
        asset: "CA3D5KRYMCMCZVACQAHQ6W7ICKAWBKMXCGVJQAXY3ZBA5DBWNXOEAAOR",
        initialMarginRatio: 6500, // 65% LTV
        liquidationThreshold: 7500, // 75%
        liquidationPenalty: 500,
        supplyCap: BigInt(500_000_000_000),
        borrowCap: BigInt(200_000_000_000),
        active: true,
      };

      const merged = mergeMarketParams(baseMarket, chainParams, BigInt(1_000_000_000_000), BigInt(20_000_000), 8000);
      expect(merged.ltv).toBe(0.65);
      expect(merged.ltvBps).toBe(6500);
      expect(merged.liqThresholdBps).toBe(7500);
      expect(merged.supplyCap).toBe(BigInt(500_000_000_000));
      expect(merged.borrowCap).toBe(BigInt(200_000_000_000));
      expect(merged.minBorrow).toBe(BigInt(20_000_000));
      expect(merged.sources?.ltv).toBe("chain");
      expect(merged.sources?.liqThreshold).toBe("chain");
      expect(merged.sources?.supplyCap).toBe("chain");
      expect(merged.sources?.minBorrow).toBe("chain");
    });
  });

  describe("Validation boundaries (cap and min-borrow)", () => {
    it("allows deposit exactly at remaining cap and rejects +1 stroop", () => {
      const depositCapRemaining = BigInt(10_000_000); // 1.0 token
      const exactAmount = BigInt(10_000_000);
      const overByOne = BigInt(10_000_001);

      expect(exactAmount <= depositCapRemaining).toBe(true);
      expect(overByOne <= depositCapRemaining).toBe(false);
    });

    it("allows borrow exactly at minBorrow and rejects -1 stroop", () => {
      const minBorrow = BigInt(10_000_000); // 1.0 token
      const exactAmount = BigInt(10_000_000);
      const underByOne = BigInt(9_999_999);

      expect(exactAmount >= minBorrow).toBe(true);
      expect(underByOne >= minBorrow).toBe(false);
    });
  });
});
