import { describe, expect, it, vi } from "vitest";
import {
  fetchWalletBalances,
  formatWalletBalance,
  normalizeWalletBalances,
} from "./balances";

const assets = [
  {
    symbol: "XLM",
    name: "Stellar Lumens",
    decimals: 7,
    issuer: "native",
    logoUrl: "https://example.com/xlm.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    issuer: "GISSUER",
    logoUrl: "https://example.com/usdc.png",
  },
];

describe("wallet balances", () => {
  it("formats native balances with registry decimals", () => {
    expect(
      formatWalletBalance(
        { asset_type: "native", balance: "0.0000000" },
        assets,
      ),
    ).toMatchObject({
      symbol: "XLM",
      name: "Stellar Lumens",
      formatted: "0.0000000",
      hasMetadata: true,
    });
  });

  it("formats credit balances with grouping and asset metadata", () => {
    expect(
      formatWalletBalance(
        {
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          balance: "1234567.123456",
        },
        assets,
      ),
    ).toMatchObject({
      symbol: "USDC",
      name: "USD Coin",
      formatted: "1,234,567.123456",
      hasMetadata: true,
    });
  });

  it("keeps unknown asset balances visible with fallback metadata", () => {
    expect(
      formatWalletBalance(
        {
          asset_type: "credit_alphanum4",
          asset_code: "DOGE",
          balance: "42.1",
        },
        assets,
      ),
    ).toMatchObject({
      symbol: "DOGE",
      name: "Unknown asset",
      formatted: "42.1000000",
      hasMetadata: false,
    });
  });

  it("sorts XLM first and then symbols alphabetically", () => {
    expect(
      normalizeWalletBalances(
        [
          { asset_type: "credit_alphanum4", asset_code: "USDC", balance: "2" },
          { asset_type: "native", balance: "1" },
          { asset_type: "credit_alphanum4", asset_code: "DOGE", balance: "3" },
        ],
        assets,
      ).map((balance) => balance.symbol),
    ).toEqual(["XLM", "DOGE", "USDC"]);
  });

  it("fetches balances from the configured Horizon account endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          balances: [{ asset_type: "native", balance: "12.5" }],
        }),
      }),
    );

    await expect(
      fetchWalletBalances("GABC", "https://horizon.example.com/"),
    ).resolves.toMatchObject([{ symbol: "XLM" }]);
    expect(fetch).toHaveBeenCalledWith(
      "https://horizon.example.com/accounts/GABC",
    );

    vi.unstubAllGlobals();
  });

  it("throws when Horizon rejects the account lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    await expect(
      fetchWalletBalances("GABC", "https://horizon.example.com"),
    ).rejects.toThrow("Unable to load wallet balances");

    vi.unstubAllGlobals();
  });
});
