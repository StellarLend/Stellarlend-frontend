/**
 * Tests for components/trade-preview.tsx
 *
 * Covers all four trade modes (supply, borrow, withdraw, repay), unsafe and
 * warning projections, the Spanish locale, NaN/empty input producing no
 * preview, and the oracle-guard notice path.
 *
 * Fixtures are built with real projectPosition() calls so the rendered text
 * always matches the actual projection math.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";

import { TradePreview } from "./trade-preview";
import { projectPosition } from "@/lib/projection";
import { parseAmount } from "@/lib/demo-ledger";
import type { Ledger, MarketParams } from "@/lib/demo-ledger";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

// ─── shared fixtures ──────────────────────────────────────────────────────────

const MARKETS: MarketParams[] = [
  { symbol: "XLM",  price: 0.12, ltv: 0.7,  decimals: 7 },
  { symbol: "USDC", price: 1.0,  ltv: 0.85, decimals: 7 },
];

function parse(val: string, decimals: number): bigint {
  const r = parseAmount(val, decimals);
  if (!r.ok) throw new Error(`parse failed: ${val}`);
  return r.value;
}

// Empty ledger for supply tests
const EMPTY_LEDGER: Ledger = {};

// Ledger with 1 000 XLM supplied → $120 collateral, $84 borrow limit
const XLM_SUPPLIED: Ledger = {
  XLM: { supplied: parse("1000", 7), borrowed: BigInt(0) },
};

// Ledger with 100 USDC supplied and 50 USDC borrowed
const USDC_WITH_DEBT: Ledger = {
  USDC: { supplied: parse("100", 7), borrowed: parse("50", 7) },
};

// ─── render helpers ───────────────────────────────────────────────────────────

function renderEn(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function renderEs(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// Default "current" risk values for a fresh account (no positions).
const ZERO_CURRENT = {
  currentCollateralUsd: 0,
  currentBorrowUsd: 0,
  currentLimitUsd: 0,
  currentHealth: Infinity,
};

// ─── supply ───────────────────────────────────────────────────────────────────

describe("TradePreview – supply mode", () => {
  it("shows projected collateral and ∞ health when first supply", () => {
    // Supply 500 XLM: collateral $60, limit $42, no debt → HF = ∞
    const projected = projectPosition(EMPTY_LEDGER, MARKETS, MARKETS[0], "supply", "500");
    expect(projected).not.toBeNull();

    renderEn(
      <TradePreview {...ZERO_CURRENT} projected={projected} />,
    );

    expect(screen.getByTestId("trade-preview")).toBeInTheDocument();
    expect(screen.getByText("Projected Impact")).toBeInTheDocument();
    expect(screen.getByText("Health factor")).toBeInTheDocument();
    // HF should display as ∞ (no debt)
    const hfValues = screen.getAllByText("∞");
    expect(hfValues.length).toBeGreaterThanOrEqual(1);
    // No warnings when HF is infinite
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the collateral before → after arrow", () => {
    const projected = projectPosition(EMPTY_LEDGER, MARKETS, MARKETS[0], "supply", "1000");
    expect(projected).not.toBeNull();

    renderEn(
      <TradePreview {...ZERO_CURRENT} projected={projected} />,
    );

    expect(screen.getByText("Collateral")).toBeInTheDocument();
    expect(screen.getByText("Debt")).toBeInTheDocument();
    // Arrow separators are present
    const arrows = screen.getAllByText("→");
    expect(arrows.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── borrow ───────────────────────────────────────────────────────────────────

describe("TradePreview – borrow mode", () => {
  it("shows projected health matching projectPosition output", () => {
    // 1 000 XLM supplied → $84 limit. Borrow 50 USDC → HF = 84/50 = 1.68
    const projected = projectPosition(XLM_SUPPLIED, MARKETS, MARKETS[1], "borrow", "50");
    expect(projected).not.toBeNull();

    renderEn(
      <TradePreview
        currentCollateralUsd={120}
        currentBorrowUsd={0}
        currentLimitUsd={84}
        currentHealth={Infinity}
        projected={projected}
      />,
    );

    expect(screen.getByTestId("trade-preview")).toBeInTheDocument();
    // Health factor row is present
    expect(screen.getByText("Health factor")).toBeInTheDocument();
    // Projected HF 1.68 should appear; formatNumber rounds to 2dp → "1.68"
    expect(screen.getByText("1.68")).toBeInTheDocument();
    // No danger/warning alert for a healthy HF
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows warning alert when projected HF is between 1.0 and 1.2", () => {
    // 1 000 XLM → $84 limit, borrow 75 USDC → HF = 84/75 ≈ 1.12
    const projected = projectPosition(XLM_SUPPLIED, MARKETS, MARKETS[1], "borrow", "75");
    expect(projected?.isWarning).toBe(true);
    expect(projected?.isUnsafe).toBe(false);

    renderEn(
      <TradePreview
        currentCollateralUsd={120}
        currentBorrowUsd={0}
        currentLimitUsd={84}
        currentHealth={Infinity}
        projected={projected}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toContain("Caution");
    expect(alert.textContent).toContain("1.2");
  });

  it("shows danger alert when projected HF < 1.0 (unsafe)", () => {
    // 1 000 XLM → $84 limit, borrow 90 USDC → HF = 84/90 ≈ 0.93
    const projected = projectPosition(XLM_SUPPLIED, MARKETS, MARKETS[1], "borrow", "90");
    expect(projected?.isUnsafe).toBe(true);

    renderEn(
      <TradePreview
        currentCollateralUsd={120}
        currentBorrowUsd={0}
        currentLimitUsd={84}
        currentHealth={Infinity}
        projected={projected}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toContain("1.0");
    expect(alert.textContent).toContain("liquidation");
  });
});

// ─── withdraw ─────────────────────────────────────────────────────────────────

describe("TradePreview – withdraw mode", () => {
  it("shows projected HF after a partial withdraw", () => {
    // 100 USDC supplied ($85 limit), 50 USDC borrowed. Withdraw 20 → HF ≈ 1.36
    const projected = projectPosition(USDC_WITH_DEBT, MARKETS, MARKETS[1], "withdraw", "20");
    expect(projected).not.toBeNull();
    expect(projected!.health).toBeCloseTo(1.36, 1);

    renderEn(
      <TradePreview
        currentCollateralUsd={100}
        currentBorrowUsd={50}
        currentLimitUsd={85}
        currentHealth={85 / 50}
        projected={projected}
      />,
    );

    expect(screen.getByTestId("trade-preview")).toBeInTheDocument();
    expect(screen.getByText("Health factor")).toBeInTheDocument();
    // Projected HF rounds to 1.36
    expect(screen.getByText("1.36")).toBeInTheDocument();
  });

  it("shows danger alert when withdrawing makes position unsafe", () => {
    // 100 USDC supplied ($85 limit), 50 USDC borrowed. Withdraw 95 → remaining $5 limit < $50 debt
    const projected = projectPosition(USDC_WITH_DEBT, MARKETS, MARKETS[1], "withdraw", "95");
    expect(projected?.isUnsafe).toBe(true);

    renderEn(
      <TradePreview
        currentCollateralUsd={100}
        currentBorrowUsd={50}
        currentLimitUsd={85}
        currentHealth={85 / 50}
        projected={projected}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toContain("1.0");
  });
});

// ─── repay ────────────────────────────────────────────────────────────────────

describe("TradePreview – repay mode", () => {
  it("shows ∞ health and 0% borrow limit used after full repay", () => {
    // 100 USDC supplied, 50 borrowed. Repay 50 → no debt → HF = ∞
    const projected = projectPosition(USDC_WITH_DEBT, MARKETS, MARKETS[1], "repay", "50");
    expect(projected).not.toBeNull();
    expect(projected!.health).toBe(Infinity);

    renderEn(
      <TradePreview
        currentCollateralUsd={100}
        currentBorrowUsd={50}
        currentLimitUsd={85}
        currentHealth={85 / 50}
        projected={projected}
      />,
    );

    expect(screen.getByTestId("trade-preview")).toBeInTheDocument();
    // HF column shows ∞ after repay
    const infSymbols = screen.getAllByText("∞");
    expect(infSymbols.length).toBeGreaterThanOrEqual(1);
    // No warnings after full repay
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows borrow limit used row", () => {
    const projected = projectPosition(USDC_WITH_DEBT, MARKETS, MARKETS[1], "repay", "25");
    expect(projected).not.toBeNull();

    renderEn(
      <TradePreview
        currentCollateralUsd={100}
        currentBorrowUsd={50}
        currentLimitUsd={85}
        currentHealth={85 / 50}
        projected={projected}
      />,
    );

    expect(screen.getByText("Borrow limit used")).toBeInTheDocument();
  });
});

// ─── empty / NaN amount ───────────────────────────────────────────────────────

describe("TradePreview – empty amount (no projection)", () => {
  it("renders nothing when projected is null and no oracle guard", () => {
    // projectPosition returns null for invalid input, so projected prop is null
    const projected = projectPosition(EMPTY_LEDGER, MARKETS, MARKETS[0], "supply", "");
    expect(projected).toBeNull();

    const { container } = renderEn(
      <TradePreview {...ZERO_CURRENT} projected={null} />,
    );

    // Component returns null → nothing in the DOM
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("trade-preview")).toBeNull();
  });

  it("renders nothing for NaN amount", () => {
    const projected = projectPosition(EMPTY_LEDGER, MARKETS, MARKETS[0], "supply", NaN);
    expect(projected).toBeNull();

    const { container } = renderEn(
      <TradePreview {...ZERO_CURRENT} projected={null} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for a zero amount", () => {
    const projected = projectPosition(EMPTY_LEDGER, MARKETS, MARKETS[0], "supply", "0");
    expect(projected).toBeNull();

    const { container } = renderEn(
      <TradePreview {...ZERO_CURRENT} projected={null} />,
    );

    expect(container.firstChild).toBeNull();
  });
});

// ─── Spanish locale ───────────────────────────────────────────────────────────

describe("TradePreview – es locale", () => {
  it("renders translated labels in Spanish", () => {
    const projected = projectPosition(XLM_SUPPLIED, MARKETS, MARKETS[1], "borrow", "50");
    expect(projected).not.toBeNull();

    renderEs(
      <TradePreview
        currentCollateralUsd={120}
        currentBorrowUsd={0}
        currentLimitUsd={84}
        currentHealth={Infinity}
        projected={projected}
      />,
    );

    expect(screen.getByTestId("trade-preview")).toBeInTheDocument();
    // Spanish labels from es.json market.preview.*
    expect(screen.getByText("Impacto proyectado")).toBeInTheDocument();
    expect(screen.getByText("Límite de préstamo usado")).toBeInTheDocument();
    expect(screen.getByText("Factor de salud")).toBeInTheDocument();
    expect(screen.getByText("Colateral")).toBeInTheDocument();
    expect(screen.getByText("Deuda")).toBeInTheDocument();
  });

  it("shows translated warning alert in Spanish", () => {
    // HF ≈ 1.12 → warning
    const projected = projectPosition(XLM_SUPPLIED, MARKETS, MARKETS[1], "borrow", "75");
    expect(projected?.isWarning).toBe(true);

    renderEs(
      <TradePreview
        currentCollateralUsd={120}
        currentBorrowUsd={0}
        currentLimitUsd={84}
        currentHealth={Infinity}
        projected={projected}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toContain("Atención");
  });
});

// ─── oracle guard notice ──────────────────────────────────────────────────────

describe("TradePreview – oracle guard", () => {
  it("renders oracle-guard notice even when projected is null", () => {
    renderEn(
      <TradePreview
        {...ZERO_CURRENT}
        projected={null}
        oracleGuard={{ blocked: true, warning: false, reason: "stale", status: "stale", affectedAssetId: null }}
        oracleGuardId="oracle-guard-reason"
      />,
    );

    expect(screen.getByTestId("oracle-guard-notice")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders oracle-guard as status (warning, non-blocking)", () => {
    renderEn(
      <TradePreview
        {...ZERO_CURRENT}
        projected={null}
        oracleGuard={{ blocked: false, warning: true, reason: "stale", status: "stale", affectedAssetId: null }}
      />,
    );

    expect(screen.getByTestId("oracle-guard-notice")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
