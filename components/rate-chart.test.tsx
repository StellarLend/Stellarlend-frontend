import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RateChart } from "./rate-chart";
import {
  DEFAULT_RATE_PARAMS,
  type RateModelDiagnostics,
  type UtilizationSample,
} from "@/lib/rate-model";

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
    render(
      <RateChart
        params={DEFAULT_RATE_PARAMS}
        diagnostics={activeDiagnostics}
        history={sampleHistory}
        source="contract"
      />
    );

    // Accessible SVG names
    expect(
      screen.getByRole("img", { name: "Two-slope borrow rate curve chart" })
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
    expect(historyScope.getByText("500120")).toBeInTheDocument();
    expect(historyScope.getByText("500100")).toBeInTheDocument();
  });

  it("renders an explanatory empty state when utilization history is empty", () => {
    render(
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

    render(
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
});
