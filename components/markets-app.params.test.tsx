import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import MarketsApp from "./markets-app";
import enMessages from "@/messages/en.json";

vi.mock("@/lib/market-params", () => ({
  fetchLiveMarketParams: vi.fn().mockResolvedValue([
    {
      symbol: "XLM",
      name: "Stellar Lumens",
      price: 0.12,
      supplyApy: 3.4,
      borrowApy: 6.1,
      totalSupply: 48_200_000,
      totalBorrow: 21_400_000,
      ltv: 0.65,
      ltvBps: 6500,
      liqThresholdBps: 7500,
      supplyCap: BigInt(50_000_000_000_000), // 5M XLM cap in stroops
      borrowCap: BigInt(20_000_000_000_000),
      depositCapRemaining: BigInt(10_000_000), // 1.0 XLM remaining
      minBorrow: BigInt(20_000_000), // 2.0 XLM min borrow
      decimals: 7,
      sources: {
        ltv: "chain",
        liqThreshold: "chain",
        supplyCap: "chain",
        borrowCap: "chain",
        depositCapRemaining: "chain",
        minBorrow: "chain",
        totalSupply: "demo",
        totalBorrow: "demo",
      },
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      price: 1,
      supplyApy: 5.2,
      borrowApy: 7.8,
      totalSupply: 12_600_000,
      totalBorrow: 8_900_000,
      ltv: 0.85,
      ltvBps: 8500,
      liqThresholdBps: 8000,
      supplyCap: BigInt(0), // Uncapped
      borrowCap: BigInt(0),
      depositCapRemaining: null,
      minBorrow: BigInt(10_000_000),
      decimals: 7,
      sources: {
        ltv: "demo",
        liqThreshold: "demo",
        supplyCap: "demo",
        borrowCap: "demo",
        depositCapRemaining: "demo",
        minBorrow: "demo",
        totalSupply: "demo",
        totalBorrow: "demo",
      },
    },
  ]),
  bpsToPercent: (bps: number) => Math.round(bps * 100) / 10000,
}));

describe("MarketsApp risk parameters & caps", () => {
  it("renders LTV, Liquidation threshold, and Capacity columns and badges", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MarketsApp />
      </NextIntlClientProvider>
    );

    expect(screen.getByText("LTV")).toBeInTheDocument();
    expect(screen.getByText("Liquidation threshold")).toBeInTheDocument();
    expect(screen.getByText("Capacity")).toBeInTheDocument();

    await waitFor(() => {
      // XLM has chain source badges
      const chainBadges = screen.getAllByText("chain");
      expect(chainBadges.length).toBeGreaterThan(0);
      // USDC has demo source badges
      const demoBadges = screen.getAllByText("demo");
      expect(demoBadges.length).toBeGreaterThan(0);
      // USDC is uncapped
      expect(screen.getByText("Uncapped")).toBeInTheDocument();
    });
  });

  it("blocks deposit exceeding remaining deposit capacity", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MarketsApp />
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Trade")[0]).toBeInTheDocument();
    });

    const tradeBtns = screen.getAllByText("Trade");
    fireEvent.click(tradeBtns[0]); // XLM (remaining cap is 1.0 XLM = 10_000_000 stroops)

    const input = screen.getByRole("textbox", { name: /amount in xlm/i });
    // Try to deposit 2.0 XLM (exceeds 1.0 remaining cap)
    fireEvent.change(input, { target: { value: "2" } });

    const confirmBtn = screen.getByRole("button", { name: /confirm supply/i });
    fireEvent.click(confirmBtn);

    expect(
      screen.getByText("This deposit would exceed the market deposit limit.")
    ).toBeInTheDocument();
  });

  it("blocks borrow below minimum borrow limit", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MarketsApp />
      </NextIntlClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Trade")[0]).toBeInTheDocument();
    });

    const tradeBtns = screen.getAllByText("Trade");
    fireEvent.click(tradeBtns[0]); // XLM (minBorrow is 2.0 XLM = 20_000_000 stroops)

    // Switch to Borrow
    const borrowTab = screen.getByRole("button", { name: "Borrow" });
    fireEvent.click(borrowTab);

    const input = screen.getByRole("textbox", { name: /amount in xlm/i });
    // Try to borrow 1.0 XLM (below 2.0 min borrow)
    fireEvent.change(input, { target: { value: "1" } });

    const confirmBtn = screen.getByRole("button", { name: /confirm borrow/i });
    fireEvent.click(confirmBtn);

    expect(
      screen.getByText("The requested borrow is below the minimum amount.")
    ).toBeInTheDocument();
  });
});
