import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DEFAULT_RATE_PARAMS, type RateModelDiagnostics } from "@/lib/rate-model";
import { RateChart } from "./rate-chart";

it("preserves the fixed-input SVG curve geometry", () => {
  const diagnostics: RateModelDiagnostics = {
    rate_model_active: true,
    utilization_bps: 8_500n,
    target_rate_bps: 2_200n,
    applied_rate_bps: 1_950n,
    last_update_ledger: 500_120,
    elapsed_ledgers: 4,
  };

  render(
    <RateChart
      params={DEFAULT_RATE_PARAMS}
      diagnostics={diagnostics}
      history={[]}
      source="contract"
    />
  );

  const chart = screen.getByTestId("borrow-rate-curve-svg");
  const geometry = [...chart.querySelectorAll("path, polyline")].map((node) => ({
    tag: node.tagName,
    path: node.getAttribute("d") ?? node.getAttribute("points"),
  }));
  expect(geometry).toMatchInlineSnapshot(`
    [
      {
        "path": "M 52.0,202.0 L 52.0,197.1 L 66.1,194.6 L 80.2,192.2 L 94.3,189.7 L 108.4,187.2 L 122.5,184.8 L 136.6,182.3 L 150.7,179.9 L 164.8,177.4 L 178.9,174.9 L 193.0,172.5 L 207.1,170.0 L 221.2,167.6 L 235.3,165.1 L 249.4,162.6 L 263.5,160.2 L 277.6,157.7 L 291.7,155.3 L 305.8,152.8 L 319.9,150.4 L 334.0,147.9 L 348.1,145.4 L 362.2,143.0 L 376.3,140.5 L 390.4,138.1 L 404.5,135.6 L 418.6,133.1 L 432.7,130.7 L 446.8,128.2 L 460.9,125.8 L 475.0,123.3 L 489.1,120.8 L 503.2,118.4 L 517.3,106.1 L 531.4,93.8 L 545.5,81.5 L 559.6,69.2 L 573.7,56.9 L 587.8,44.6 L 601.9,32.3 L 616.0,20.0 L 616.0,202.0 Z",
        "tag": "path",
      },
      {
        "path": "52.0,197.1 66.1,194.6 80.2,192.2 94.3,189.7 108.4,187.2 122.5,184.8 136.6,182.3 150.7,179.9 164.8,177.4 178.9,174.9 193.0,172.5 207.1,170.0 221.2,167.6 235.3,165.1 249.4,162.6 263.5,160.2 277.6,157.7 291.7,155.3 305.8,152.8 319.9,150.4 334.0,147.9 348.1,145.4 362.2,143.0 376.3,140.5 390.4,138.1 404.5,135.6 418.6,133.1 432.7,130.7 446.8,128.2 460.9,125.8 475.0,123.3 489.1,120.8 503.2,118.4 517.3,106.1 531.4,93.8 545.5,81.5 559.6,69.2 573.7,56.9 587.8,44.6 601.9,32.3 616.0,20.0",
        "tag": "polyline",
      },
    ]
  `);
});
