import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CollateralBreakdown } from "./CollateralBreakdown";
import { deriveCollateralShares } from "@/hooks/usePositions";
import type { CollateralShare } from "@/hooks/usePositions";

// ─── Mock dependencies ───────────────────────────────────────────────────────

vi.mock("@/lib/assets/registry", () => ({
  getAsset: (symbol: string) => {
    const map: Record<string, { symbol: string; name: string }> = {
      XLM: { symbol: "XLM", name: "Stellar Lumens" },
      USDC: { symbol: "USDC", name: "USD Coin" },
    };
    return map[symbol] ?? null;
  },
}));

// ─── deriveCollateralShares unit tests ───────────────────────────────────────

describe("deriveCollateralShares", () => {
  it("returns empty array when no positions have collateral", () => {
    expect(deriveCollateralShares([{ id: "1", asset: "XLM", amount: 100 }])).toEqual([]);
  });

  it("returns empty array for zero collateral values", () => {
    expect(deriveCollateralShares([{ id: "1", asset: "XLM", amount: 100, collateralUsd: 0 }])).toEqual([]);
  });

  it("single asset gets 100%", () => {
    const shares = deriveCollateralShares([{ id: "1", asset: "XLM", amount: 100, collateralUsd: 500 }]);
    expect(shares).toHaveLength(1);
    expect(shares[0]).toEqual({ asset: "XLM", usdValue: 500, share: 100 });
  });

  it("shares always sum to 100", () => {
    const positions = [
      { id: "1", asset: "XLM", amount: 1, collateralUsd: 333 },
      { id: "2", asset: "USDC", amount: 1, collateralUsd: 333 },
      { id: "3", asset: "BTC", amount: 1, collateralUsd: 334 },
    ];
    const shares = deriveCollateralShares(positions);
    const sum = shares.reduce((s, r) => s + r.share, 0);
    expect(sum).toBe(100);
  });

  it("handles rounding that would otherwise exceed 100%", () => {
    // 1/3 each → 33.33% each → naively 99%; largest-remainder gives two 34% and one 32%
    const positions = [
      { id: "1", asset: "A", amount: 1, collateralUsd: 100 },
      { id: "2", asset: "B", amount: 1, collateralUsd: 100 },
      { id: "3", asset: "C", amount: 1, collateralUsd: 100 },
    ];
    const shares = deriveCollateralShares(positions);
    expect(shares.reduce((s, r) => s + r.share, 0)).toBe(100);
  });

  it("ignores positions without collateralUsd", () => {
    const positions = [
      { id: "1", asset: "XLM", amount: 1, collateralUsd: 600 },
      { id: "2", asset: "USDC", amount: 1 }, // no collateralUsd
    ];
    const shares = deriveCollateralShares(positions);
    expect(shares).toHaveLength(1);
    expect(shares[0].asset).toBe("XLM");
    expect(shares[0].share).toBe(100);
  });
});

// ─── CollateralBreakdown rendering tests ────────────────────────────────────

const multiShares: CollateralShare[] = [
  { asset: "XLM", usdValue: 3000, share: 60 },
  { asset: "USDC", usdValue: 2000, share: 40 },
];

describe("CollateralBreakdown – rendering", () => {
  it("shows loading skeleton while loading", () => {
    render(<CollateralBreakdown shares={[]} isLoading={true} />);
    expect(screen.getByLabelText("Loading collateral breakdown")).toBeInTheDocument();
  });

  it("shows empty state when no collateral and not loading", () => {
    render(<CollateralBreakdown shares={[]} isLoading={false} />);
    expect(screen.getByRole("status", { name: /no collateral/i })).toBeInTheDocument();
    expect(screen.getByText("No collateral posted")).toBeInTheDocument();
  });

  it("renders a table with correct headers", () => {
    render(<CollateralBreakdown shares={multiShares} isLoading={false} />);
    const table = screen.getByRole("table", { name: /collateral allocation breakdown/i });
    expect(within(table).getByRole("columnheader", { name: /asset/i })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /usd value/i })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /share/i })).toBeInTheDocument();
  });

  it("renders one row per collateral asset", () => {
    render(<CollateralBreakdown shares={multiShares} isLoading={false} />);
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("renders formatted USD values", () => {
    render(<CollateralBreakdown shares={multiShares} isLoading={false} />);
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
    expect(screen.getByText("$2,000.00")).toBeInTheDocument();
  });

  it("renders percentage shares", () => {
    render(<CollateralBreakdown shares={multiShares} isLoading={false} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("single asset row shows 100%", () => {
    const single: CollateralShare[] = [{ asset: "XLM", usdValue: 5000, share: 100 }];
    render(<CollateralBreakdown shares={single} isLoading={false} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("uses asset symbol for unknown assets (no registry entry)", () => {
    const unknown: CollateralShare[] = [{ asset: "UNKNOWN", usdValue: 1000, share: 100 }];
    render(<CollateralBreakdown shares={unknown} isLoading={false} />);
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });
});

describe("CollateralBreakdown – accessibility", () => {
  it("table is keyboard navigable (rows have tabIndex=0)", () => {
    render(<CollateralBreakdown shares={multiShares} isLoading={false} />);
    const rows = screen.getAllByRole("row").filter((r) => r.getAttribute("tabindex") === "0");
    expect(rows).toHaveLength(2);
  });

  it("each data row has an aria-label describing the asset", () => {
    const { container } = render(<CollateralBreakdown shares={multiShares} isLoading={false} />);
    const rows = container.querySelectorAll("tr[aria-label]");
    const labels = Array.from(rows).map((r) => r.getAttribute("aria-label") ?? "");
    // aria-label uses asset name from registry (e.g. "Stellar Lumens") or symbol fallback
    expect(labels.some((l) => /3,000/i.test(l))).toBe(true);
    expect(labels.some((l) => /2,000/i.test(l))).toBe(true);
  });

  it("column headers use scope='col'", () => {
    render(<CollateralBreakdown shares={multiShares} isLoading={false} />);
    const headers = screen.getAllByRole("columnheader");
    headers.forEach((th) => expect(th).toHaveAttribute("scope", "col"));
  });
});
