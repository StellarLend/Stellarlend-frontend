import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ProtocolStats } from "./protocol-stats";
import * as protocolModule from "@/lib/protocol";
import enMessages from "@/messages/en.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("ProtocolStats Component", () => {
  it("renders live stats when metrics are available", () => {
    const mockMetrics: protocolModule.ProtocolMetrics = {
      totalSupply: 50_000_0000000n,
      totalBorrow: 12_500_0000000n,
      utilizationBps: 2500,
      ledger: 1234567,
    };

    renderWithIntl(<ProtocolStats initialMetrics={mockMetrics} />);

    expect(screen.getByTestId("protocol-stats-live")).toBeInTheDocument();
    expect(screen.getByText("50,000 XLM")).toBeInTheDocument();
    expect(screen.getByText("12,500 XLM")).toBeInTheDocument();
    expect(screen.getByText("25.00%")).toBeInTheDocument();
    expect(screen.getByText("as of ledger 1234567")).toBeInTheDocument();
  });

  it("renders loading state when initialMetrics is not provided and fetching", () => {
    vi.spyOn(protocolModule, "getProtocolMetrics").mockReturnValue(new Promise(() => {}));

    renderWithIntl(<ProtocolStats initialMetrics={null} />);

    expect(screen.getByTestId("protocol-stats-loading")).toBeInTheDocument();
  });

  it("renders fallback state with demo data badge when RPC fails or returns null", async () => {
    vi.spyOn(protocolModule, "getProtocolMetrics").mockResolvedValue(null);

    renderWithIntl(<ProtocolStats initialMetrics={null} />);

    const fallbackSection = await screen.findByTestId("protocol-stats-fallback");
    expect(fallbackSection).toBeInTheDocument();
    expect(screen.getByTestId("demo-data-badge")).toBeInTheDocument();
    expect(screen.getByText("Demo data")).toBeInTheDocument();
  });
});
