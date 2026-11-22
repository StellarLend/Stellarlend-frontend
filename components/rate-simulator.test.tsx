import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import spanishMessages from "@/messages/es.json";
import { DEFAULT_RATE_PARAMS } from "@/lib/rate-model";
import { RateSimulator } from "./rate-simulator";
import type { RateChartOverlay } from "./rate-chart";

function renderSimulator(
  params = DEFAULT_RATE_PARAMS,
  utilizationBps = 6_500n,
  onOverlayChange = vi.fn<(overlay: RateChartOverlay | undefined) => void>()
) {
  return {
    onOverlayChange,
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RateSimulator
          params={params}
          utilizationBps={utilizationBps}
          onOverlayChange={onOverlayChange}
        />
      </NextIntlClientProvider>
    ),
  };
}

describe("RateSimulator", () => {
  it("updates APY when utilization changes", () => {
    const { onOverlayChange } = renderSimulator();

    expect(screen.getByTestId("simulated-borrow-apy")).toHaveTextContent("14.00%");
    expect(screen.getByTestId("simulated-supply-apy")).toHaveTextContent("9.10%");

    fireEvent.change(screen.getByLabelText("Utilization (%)"), {
      target: { value: "85" },
    });

    expect(screen.getByTestId("simulated-borrow-apy")).toHaveTextContent("22.00%");
    expect(screen.getByTestId("simulated-supply-apy")).toHaveTextContent("18.70%");
    expect(onOverlayChange).toHaveBeenLastCalledWith({
      params: DEFAULT_RATE_PARAMS,
      utilizationBps: 8_500n,
    });
  });

  it("rejects kink above 100 percent and keeps the last valid result", () => {
    const { onOverlayChange } = renderSimulator();

    fireEvent.change(screen.getByLabelText("Utilization (%)"), {
      target: { value: "70" },
    });
    const borrowApy = screen.getByTestId("simulated-borrow-apy").textContent;
    const supplyApy = screen.getByTestId("simulated-supply-apy").textContent;
    const lastValidOverlay = onOverlayChange.mock.lastCall?.[0];

    fireEvent.change(screen.getByLabelText("Kink (%)"), {
      target: { value: "100.01" },
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("simulated-borrow-apy")).toHaveTextContent(borrowApy ?? "");
    expect(screen.getByTestId("simulated-supply-apy")).toHaveTextContent(supplyApy ?? "");
    expect(onOverlayChange).toHaveBeenLastCalledWith(lastValidOverlay);
  });

  it("resets edited parameters to the supplied on-chain values", () => {
    const onChainParams = { ...DEFAULT_RATE_PARAMS, base_rate_bps: 350n };
    const { onOverlayChange } = renderSimulator(onChainParams);

    fireEvent.change(screen.getByLabelText("Base rate (% APR)"), {
      target: { value: "2.50" },
    });
    expect(screen.getByTestId("simulated-borrow-apy")).toHaveTextContent("15.50%");

    fireEvent.click(screen.getByRole("button", { name: "Reset to on-chain parameters" }));

    expect(screen.getByLabelText("Base rate (% APR)")).toHaveValue(3.5);
    expect(screen.getByTestId("simulated-borrow-apy")).toHaveTextContent("16.50%");
    expect(onOverlayChange).toHaveBeenLastCalledWith(undefined);
  });

  it("renders localized, labelled controls in Spanish", () => {
    render(
      <NextIntlClientProvider locale="es" messages={spanishMessages}>
        <RateSimulator
          params={DEFAULT_RATE_PARAMS}
          utilizationBps={6_500n}
          onOverlayChange={vi.fn()}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByLabelText("Utilización (%)")).toBeInTheDocument();
    expect(
      screen.getByRole("slider", {
        name: "Control deslizante de Utilización (%)",
      })
    ).toBeInTheDocument();
  });
});
