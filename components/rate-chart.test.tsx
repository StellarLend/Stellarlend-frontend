import React from "react";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import { RateChart } from "./rate-chart";
import {
  DEFAULT_RATE_PARAMS,
  type RateModelDiagnostics,
  type UtilizationSample,
} from "@/lib/rate-model";

function renderChart(
  chart: React.ReactElement,
  locale: "en" | "es" = "en"
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
    >
      {chart}
    </NextIntlClientProvider>
  );
}

describe("RateChart component", () => {
  const activeDiagnostics: RateModelDiagnostics = {
    rate_model_active: true,
    utilization_bps: 8_500n,
    target_rate_bps: 2_200n,
    applied_rate_bps: 1_950n,
    last_update_ledger: 500_120,
    elapsed_ledgers: 4,
  };

  const sampleHistory: UtilizationSample[] = [
    { ledger: 500_120, utilization_bps: 8_500n },
    { ledger: 500_110, utilization_bps: 8_000n },
    { ledger: 500_100, utilization_bps: 7_200n },
  ];

  it("renders accessible chart names, marks current utilization and applied vs target rate, and populates the fallback table", () => {
    renderChart(
      <RateChart
        params={DEFAULT_RATE_PARAMS}
        diagnostics={activeDiagnostics}
        history={sampleHistory}
        source="contract"
      />
    );

    // Accessible SVG names include a live summary of the curve.
    expect(
      screen.getByRole("img", {
        name: /Two-slope borrow rate curve chart.*85\.00% utilization/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Protocol utilization history sparkline",
      })
    ).toBeInTheDocument();

    // Diagnostics markers for current utilization, applied rate, and target rate
    expect(screen.getByTestId("diag-utilization")).toHaveTextContent("85.00%");
    expect(screen.getByTestId("diag-applied-rate")).toHaveTextContent("19.50%");
    expect(screen.getByTestId("diag-target-rate")).toHaveTextContent("22.00%");
    expect(
      screen.getByTestId("current-utilization-marker")
    ).toBeInTheDocument();
    expect(screen.getByTestId("applied-rate-dot")).toBeInTheDocument();
    expect(screen.getByTestId("target-rate-dot")).toBeInTheDocument();

    // Assert table fallback contents for the curve
    const curveTable = screen.getByTestId("rate-curve-fallback-table");
    const curveScope = within(curveTable);
    expect(curveScope.getByText("0.00%")).toBeInTheDocument();
    expect(curveScope.getByText("1.00%")).toBeInTheDocument(); // 100 bps at 0%
    expect(curveScope.getByText("80.00%")).toBeInTheDocument();
    expect(curveScope.getByText("17.00%")).toBeInTheDocument(); // 1700 bps at kink
    expect(curveScope.getByText("Kink")).toBeInTheDocument();
    expect(curveScope.getByText("Current")).toBeInTheDocument();
    expect(curveScope.getByText("37.00%")).toBeInTheDocument(); // 3700 bps at 100%

    // Assert table fallback contents for utilization history
    const historyTable = screen.getByTestId(
      "utilization-history-fallback-table"
    );
    const historyScope = within(historyTable);
    expect(historyScope.getByText("500,120")).toBeInTheDocument();
    expect(historyScope.getByText("500,100")).toBeInTheDocument();
  });

  it("exposes the rate summary as a keyboard-focusable tooltip", () => {
    renderChart(
      <RateChart
        params={DEFAULT_RATE_PARAMS}
        diagnostics={activeDiagnostics}
        history={[]}
        source="contract"
      />
    );

    const tooltip = screen.getByTestId("rate-model-summary");
    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(tooltip).toHaveAttribute("tabindex", "0");
    expect(tooltip).toHaveAttribute("aria-label", tooltip.textContent);

    tooltip.focus();
    expect(tooltip).toHaveFocus();
    expect(tooltip).toHaveAttribute("title", tooltip.textContent);
  });

  it("renders a Spanish axis label and a curve summary built from the supplied parameters", () => {
    const params = {
      ...DEFAULT_RATE_PARAMS,
      base_rate_bps: 250n,
      kink_utilization_bps: 7_500n,
      rate_ceiling_bps: 12_000n,
    };

    renderChart(
      <RateChart
        params={params}
        diagnostics={activeDiagnostics}
        history={sampleHistory}
        source="contract"
        overlay={{
          params: DEFAULT_RATE_PARAMS,
          utilizationBps: 5_000n,
        }}
      />,
      "es"
    );

    expect(screen.getByText("Utilización (%)")).toBeInTheDocument();
    expect(screen.getByText("Curva de tasa de préstamo")).toBeInTheDocument();
    expect(screen.queryByText("Borrow rate curve")).not.toBeInTheDocument();

    const curveSummary = screen.getByTestId("rate-curve-summary");
    expect(curveSummary).toHaveAttribute("role", "img");
    expect(curveSummary).toHaveAttribute(
      "aria-label",
      expect.stringContaining("2,50%")
    );
    expect(curveSummary).toHaveAttribute(
      "aria-label",
      expect.stringContaining("75,00%")
    );
    expect(curveSummary).toHaveAttribute(
      "aria-label",
      expect.stringContaining("120,00%")
    );
    expect(screen.getByTestId("diag-utilization")).toHaveTextContent("85,00%");
  });

  it("renders an explanatory empty state when utilization history is empty", () => {
    renderChart(
      <RateChart
        params={DEFAULT_RATE_PARAMS}
        diagnostics={activeDiagnostics}
        history={[]}
        source="contract"
      />
    );

    const emptyBox = screen.getByTestId("utilization-history-empty");
    expect(emptyBox).toHaveTextContent("No utilization history recorded yet");
    expect(
      screen.queryByTestId("utilization-sparkline-svg")
    ).not.toBeInTheDocument();
  });

  it("explicitly shows when rate_model_active is false and default APR applies", () => {
    const inactiveDiagnostics: RateModelDiagnostics = {
      rate_model_active: false,
      utilization_bps: 7_000n,
      target_rate_bps: 500n,
      applied_rate_bps: 500n,
      last_update_ledger: 0,
      elapsed_ledgers: 0,
    };

    renderChart(
      <RateChart
        params={DEFAULT_RATE_PARAMS}
        diagnostics={inactiveDiagnostics}
        history={[]}
        source="contract"
      />
    );

    const banner = screen.getByTestId("rate-model-inactive-banner");
    expect(banner).toHaveTextContent(
      "Rate model inactive — default APR applies"
    );
    expect(screen.getByTestId("rate-model-summary")).toHaveTextContent(
      "5.00% (500 bps)"
    );
  });

  it("overlays a proposed curve without removing the live curve", () => {
    renderChart(
      <RateChart
        params={DEFAULT_RATE_PARAMS}
        diagnostics={activeDiagnostics}
        history={[]}
        overlay={{
          params: { ...DEFAULT_RATE_PARAMS, base_rate_bps: 500n },
          utilizationBps: 7_000n,
        }}
      />
    );

    expect(screen.getByTestId("proposed-rate-curve")).toBeInTheDocument();
    expect(screen.getByTestId("proposed-utilization-marker")).toBeInTheDocument();
    expect(screen.getByTestId("proposed-rate-dot")).toBeInTheDocument();
    expect(screen.getAllByText("Proposed curve")).toHaveLength(2);
    expect(screen.getByTestId("rate-curve-fallback-table")).toHaveTextContent(
      "Proposed curve"
    );
  });
});
