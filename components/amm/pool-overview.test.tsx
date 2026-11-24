import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import { TwapChart } from "./twap-chart";
import { PoolOverview } from "./pool-overview";

function renderWithIntl(ui: React.ReactElement, locale = "en", messages: any = enMessages) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("TwapChart component", () => {
  it("renders empty state when there are fewer than 2 points", () => {
    const onWindowChange = () => {};
    renderWithIntl(<TwapChart points={[]} onWindowChange={onWindowChange} />);
    expect(screen.getByText(/Insufficient TWAP observations/i)).toBeInTheDocument();
  });

  it("renders price line and latest price when points >= 2", () => {
    const onWindowChange = () => {};
    const points = [
      { timestamp: 1000, price: "1.25" },
      { timestamp: 1060, price: "1.30" },
      { timestamp: 1120, price: "1.35" },
    ];
    renderWithIntl(<TwapChart points={points} onWindowChange={onWindowChange} />);
    expect(screen.getByText("1.35")).toBeInTheDocument();
    expect(screen.getByText("Latest TWAP")).toBeInTheDocument();
  });
});

describe("PoolOverview component", () => {
  it("PoolOverview renders Spanish heading", () => {
    renderWithIntl(<PoolOverview />, "es", esMessages);
    expect(
      screen.getByRole("heading", { name: /AMM no configurado|Resumen de la piscina AMM/i }),
    ).toBeInTheDocument();
  });
});
