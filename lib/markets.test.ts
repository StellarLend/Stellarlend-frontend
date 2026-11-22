import { describe, expect, it } from "vitest";
import {
  MARKETS,
  buildMarketQueryString,
  filterAndSortMarkets,
  parseMarketQueryParams,
  parseMarketSort,
  type Market,
} from "./markets";

describe("filterAndSortMarkets", () => {
  it("preserves default order when no filters or sort are provided", () => {
    const result = filterAndSortMarkets(MARKETS, {});
    expect(result.map((m) => m.symbol)).toEqual(MARKETS.map((m) => m.symbol));
    expect(result).not.toBe(MARKETS);
  });

  it("filters by symbol case-insensitively", () => {
    const result = filterAndSortMarkets(MARKETS, { q: "xlm" });
    expect(result.map((m) => m.symbol)).toEqual(["XLM"]);
  });

  it("filters by asset name case-insensitively and trims whitespace", () => {
    const result = filterAndSortMarkets(MARKETS, { q: "  bitcoin  " });
    expect(result.map((m) => m.symbol)).toEqual(["BTC"]);
  });

  it("matches partial substrings across multiple markets", () => {
    const result = filterAndSortMarkets(MARKETS, { q: "coin" });
    expect(result.map((m) => m.symbol)).toEqual(["USDC", "EURC"]);
  });

  it("sorts by supply apy desc", () => {
    const result = filterAndSortMarkets(MARKETS, { sort: "supplyApy" });
    expect(result.map((m) => m.symbol)).toEqual(["USDC", "EURC", "XLM", "BTC"]);
  });

  it("sorts by borrow apy desc", () => {
    const result = filterAndSortMarkets(MARKETS, { sort: "borrowApy" });
    expect(result.map((m) => m.symbol)).toEqual(["USDC", "EURC", "XLM", "BTC"]);
  });

  it("sorts by utilization desc", () => {
    // Utilization: USDC (~70.6%), EURC (~54.8%), XLM (~44.4%), BTC (~22.9%)
    const result = filterAndSortMarkets(MARKETS, { sort: "utilization" });
    expect(result.map((m) => m.symbol)).toEqual(["USDC", "EURC", "XLM", "BTC"]);
  });

  it("is stable and preserves original order on ties", () => {
    const tied: Market[] = [
      { ...MARKETS[0], symbol: "AAA", supplyApy: 5.0, borrowApy: 7.0, totalSupply: 100, totalBorrow: 50 },
      { ...MARKETS[1], symbol: "BBB", supplyApy: 5.0, borrowApy: 7.0, totalSupply: 200, totalBorrow: 100 },
      { ...MARKETS[2], symbol: "CCC", supplyApy: 5.0, borrowApy: 7.0, totalSupply: 400, totalBorrow: 200 },
    ];
    expect(filterAndSortMarkets(tied, { sort: "supplyApy" }).map((m) => m.symbol)).toEqual(["AAA", "BBB", "CCC"]);
    expect(filterAndSortMarkets(tied, { sort: "borrowApy" }).map((m) => m.symbol)).toEqual(["AAA", "BBB", "CCC"]);
    expect(filterAndSortMarkets(tied, { sort: "utilization" }).map((m) => m.symbol)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("ignores unknown sort and keeps default order", () => {
    const result = filterAndSortMarkets(MARKETS, { sort: "unknownSort" });
    expect(result.map((m) => m.symbol)).toEqual(MARKETS.map((m) => m.symbol));
    expect(parseMarketSort("unknownSort")).toBe("default");
  });

  it("filters to markets with open positions when mine is enabled", () => {
    const positions = {
      XLM: { supplied: BigInt(100), borrowed: BigInt(0) },
      EURC: { supplied: BigInt(0), borrowed: BigInt(50) },
      USDC: { supplied: BigInt(0), borrowed: BigInt(0) },
    };
    const result = filterAndSortMarkets(MARKETS, { mine: true }, positions);
    expect(result.map((m) => m.symbol)).toEqual(["XLM", "EURC"]);

    const resultFromQuery = filterAndSortMarkets(MARKETS, { mine: "1" }, positions);
    expect(resultFromQuery.map((m) => m.symbol)).toEqual(["XLM", "EURC"]);
  });

  it("returns empty array when no markets match", () => {
    expect(filterAndSortMarkets(MARKETS, { q: "DOGE" })).toEqual([]);
    expect(filterAndSortMarkets(MARKETS, { mine: true }, {})).toEqual([]);
  });
});

describe("market query params helpers", () => {
  it("parses and sanitizes query params", () => {
    const parsed = parseMarketQueryParams(new URLSearchParams("q=usdc&sort=borrowApy&mine=1"));
    expect(parsed).toEqual({ q: "usdc", sort: "borrowApy", mine: true });

    const sanitized = parseMarketQueryParams(new URLSearchParams("q=&sort=invalid&mine=0"));
    expect(sanitized).toEqual({ q: "", sort: "default", mine: false });
  });

  it("builds clean query strings and preserves unrelated params", () => {
    const qs = buildMarketQueryString(
      { q: "  xlm ", sort: "utilization", mine: true },
      new URLSearchParams("tab=all")
    );
    expect(qs).toBe("tab=all&q=xlm&sort=utilization&mine=1");

    const cleared = buildMarketQueryString(
      { q: "", sort: "default", mine: false },
      new URLSearchParams("tab=all&q=xlm&sort=utilization&mine=1")
    );
    expect(cleared).toBe("tab=all");
  });
});
