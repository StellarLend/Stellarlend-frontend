import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TwapChart } from "./twap-chart";
import { twapSeries, type TwapObservation } from "@/lib/amm/twap";

function TwapChartHarness({ observations }: { observations: TwapObservation[] }) {
  const [windowSecs, setWindowSecs] = useState(3600);
  const points = twapSeries(observations, windowSecs);

  return (
    <TwapChart
      points={points}
      windowSecs={windowSecs}
      onWindowChange={setWindowSecs}
    />
  );
}

describe("TwapChart", () => {
  it("recomputes series per window", () => {
    const observations: TwapObservation[] = [];
    for (let i = 0; i <= 48; i++) {
      observations.push({
        timestamp: BigInt(1000 + i * 1800),
        cumNum: BigInt(i * 100),
        cumDenom: BigInt(i * 10),
      });
    }

    render(<TwapChartHarness observations={observations} />);

    expect(screen.getByRole("radiogroup", { name: "TWAP window" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "1h" })).toBeChecked();

    const oneHourPath = document.querySelector("path[stroke='var(--acc)']");
    const oneHourCount = twapSeries(observations, 3600).length;
    expect((oneHourPath?.getAttribute("d")?.match(/L/g) ?? []).length).toBe(
      oneHourCount - 1,
    );

    fireEvent.click(screen.getByRole("radio", { name: "24h" }));
    expect(screen.getByRole("radio", { name: "24h" })).toBeChecked();

    const twentyFourHourPath = document.querySelector("path[stroke='var(--acc)']");
    const twentyFourHourCount = twapSeries(observations, 86400).length;
    expect((twentyFourHourPath?.getAttribute("d")?.match(/L/g) ?? []).length).toBe(
      twentyFourHourCount - 1,
    );
    expect(twentyFourHourCount).toBeGreaterThan(oneHourCount);
  });

  it("shows empty state with one observation", () => {
    const onWindowChange = vi.fn();
    render(
      <TwapChart
        points={[{ timestamp: 1000, price: "1.25" }]}
        onWindowChange={onWindowChange}
      />,
    );

    expect(
      screen.getByText(/Insufficient TWAP observations/i),
    ).toBeInTheDocument();
    expect(document.querySelector("path[stroke='var(--acc)']")).not.toBeInTheDocument();
  });
});
