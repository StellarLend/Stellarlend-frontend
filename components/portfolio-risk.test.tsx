import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { PortfolioRisk } from "./portfolio-risk";
import { MARKETS } from "@/lib/markets";
import { parseAmount, type Ledger } from "@/lib/demo-ledger";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

function parseSafe(val: string, decimals = 7): bigint {
  const res = parseAmount(val, decimals);
  if (!res.ok) throw new Error(`Failed to parse ${val}`);
  return res.value;
}

function renderPortfolioRisk(ledger: Ledger, locale: "en" | "es" = "en") {
  const messages = locale === "es" ? esMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PortfolioRisk ledger={ledger} markets={MARKETS} />
    </NextIntlClientProvider>
  );
}

describe("PortfolioRisk", () => {
  it("shows No debt state when user has collateral but zero debt", () => {
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("1000"), borrowed: BigInt(0) },
    };
    renderPortfolioRisk(ledger);

    expect(screen.getByTestId("portfolio-risk-health")).toHaveTextContent("No debt");
    expect(screen.getByTestId("portfolio-risk-level")).toHaveTextContent("No debt");
    expect(screen.getByTestId("liq-price-XLM")).toHaveTextContent("-");
  });

  it("slider -30% flips level to danger", () => {
    // 1000 XLM @ $0.12, LTV 0.7 -> $84 limit
    // 52 USDC borrowed -> base HF = 84 / 52 = 1.615 (safe >= 1.5)
    // At -30% shock -> projected HF = 1.615 * 0.7 = 1.13 (danger: 1.0 <= HF < 1.2)
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("1000"), borrowed: BigInt(0) },
      USDC: { supplied: BigInt(0), borrowed: parseSafe("52") },
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderPortfolioRisk(ledger);

    const levelChip = screen.getByTestId("portfolio-risk-level");
    expect(levelChip).toHaveAttribute("data-level", "safe");
    expect(levelChip).toHaveTextContent("Safe");

    const slider = screen.getByRole("slider", { name: "Collateral price shock" });
    fireEvent.change(slider, { target: { value: "-30" } });

    expect(levelChip).toHaveAttribute("data-level", "danger");
    expect(levelChip).toHaveTextContent("Danger");

    // Slider changes must not trigger any RPC/network calls
    expect(fetchSpy).not.toHaveBeenCalled();

    // Reset button restores 0% shock and safe level
    const resetBtn = screen.getByRole("button", { name: "Reset" });
    fireEvent.click(resetBtn);
    expect(levelChip).toHaveAttribute("data-level", "safe");

    fetchSpy.mockRestore();
  });

  it("formats values according to locale", () => {
    const ledger: Ledger = {
      XLM: { supplied: parseSafe("1000"), borrowed: BigInt(0) },
      USDC: { supplied: BigInt(0), borrowed: parseSafe("50") },
    };
    renderPortfolioRisk(ledger, "es");

    expect(screen.getByText("Riesgo de portafolio")).toBeInTheDocument();
    // 84 / 50 = 1.68 -> formatted in Spanish locale as "1,68"
    expect(screen.getByTestId("portfolio-risk-health")).toHaveTextContent("1,68");
  });
});
