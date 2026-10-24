import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import OraclePanel, { OracleStatusChip } from "./oracle-panel";
import type { OracleAssetPrice } from "@/lib/oracle";

const messages = {
  market: {
    oracle: {
      title: "On-chain oracle prices",
      subtitle: "Prices, freshness, and bounds recorded by the lending contract.",
      fresh: "Fresh",
      stale: "Stale",
      future: "Future-dated",
      missing: "Missing",
      noOnChainPrice: "No on-chain price",
      oracleSource: "Oracle",
      demoSource: "Demo price",
      updatedAgo: "Updated {time}",
      justNow: "just now",
      staleWarning: "Stale price (>1h old): new borrows and liquidations will fail.",
      futureWarning: "Future-dated timestamp: contract rejects timestamp > ledger close time.",
      bounds: "Bounds",
      min: "Min: {price}",
      max: "Max: {price}",
      noBounds: "No bounds set",
      timeSourceLedger: "Ledger time",
      timeSourceBrowser: "Browser clock",
      loading: "Loading oracle prices...",
    },
  },
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("OracleStatusChip", () => {
  it("renders Fresh chip", () => {
    renderWithIntl(<OracleStatusChip status="fresh" />);
    const chip = screen.getByTestId("status-chip-fresh");
    expect(chip).toHaveTextContent("Fresh");
    expect(chip).toHaveClass("text-emerald-400");
  });

  it("renders Stale chip", () => {
    renderWithIntl(<OracleStatusChip status="stale" />);
    const chip = screen.getByTestId("status-chip-stale");
    expect(chip).toHaveTextContent("Stale");
    expect(chip).toHaveClass("text-amber-400");
  });

  it("renders Future chip", () => {
    renderWithIntl(<OracleStatusChip status="future" />);
    const chip = screen.getByTestId("status-chip-future");
    expect(chip).toHaveTextContent("Future-dated");
    expect(chip).toHaveClass("text-purple-400");
  });

  it("renders Missing chip", () => {
    renderWithIntl(<OracleStatusChip status="missing" />);
    const chip = screen.getByTestId("status-chip-missing");
    expect(chip).toHaveTextContent("Missing");
    expect(chip).toHaveClass("text-zinc-400");
  });
});

describe("OraclePanel", () => {
  const dummyAsset = "CA3D5KRYM6CB7OWQ6TWYRR3Z4EK7HX3ZNV6HG7L4CHOHP7S2YYKZ5K7K";

  it("renders empty state when no prices exist", () => {
    renderWithIntl(<OraclePanel prices={{}} timeSource="ledger" />);
    expect(screen.getByTestId("oracle-empty")).toHaveTextContent("No on-chain price");
  });

  it("renders card with fresh price and bounds", () => {
    const prices: Record<string, OracleAssetPrice> = {
      [dummyAsset]: {
        assetId: dummyAsset,
        symbol: "USDC",
        price: 10_000_000n,
        priceNumber: 1.0,
        timestamp: 1_700_000_000n,
        ageSeconds: 60,
        status: "fresh",
        bounds: { min: 9_000_000n, max: 11_000_000n },
        source: "oracle",
      },
    };

    renderWithIntl(<OraclePanel prices={prices} timeSource="ledger" />);
    expect(screen.getByText("$1.00")).toBeInTheDocument();
    expect(screen.getByTestId("status-chip-fresh")).toBeInTheDocument();
    expect(screen.getByText("Min: $0.90")).toBeInTheDocument();
    expect(screen.getByText("Max: $1.10")).toBeInTheDocument();
    expect(screen.getByText("Ledger time")).toBeInTheDocument();
  });

  it("renders warning banner for stale status", () => {
    const prices: Record<string, OracleAssetPrice> = {
      [dummyAsset]: {
        assetId: dummyAsset,
        symbol: "USDC",
        price: 10_000_000n,
        priceNumber: 1.0,
        timestamp: 1_700_000_000n,
        ageSeconds: 3700,
        status: "stale",
        bounds: { min: null, max: null },
        source: "oracle",
      },
    };

    renderWithIntl(<OraclePanel prices={prices} timeSource="browser" />);
    expect(
      screen.getByText("Stale price (>1h old): new borrows and liquidations will fail.")
    ).toBeInTheDocument();
    expect(screen.getByText("Browser clock")).toBeInTheDocument();
    expect(screen.getByText("No bounds set")).toBeInTheDocument();
  });

  it("renders warning banner for future-dated status", () => {
    const prices: Record<string, OracleAssetPrice> = {
      [dummyAsset]: {
        assetId: dummyAsset,
        symbol: "USDC",
        price: 10_000_000n,
        priceNumber: 1.0,
        timestamp: 1_700_000_000n,
        ageSeconds: -10,
        status: "future",
        bounds: { min: null, max: null },
        source: "oracle",
      },
    };

    renderWithIntl(<OraclePanel prices={prices} timeSource="ledger" />);
    expect(
      screen.getByText(
        "Future-dated timestamp: contract rejects timestamp > ledger close time."
      )
    ).toBeInTheDocument();
  });
});
