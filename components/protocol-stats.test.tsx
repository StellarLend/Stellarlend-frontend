import React from "react";
import { afterEach, describe, expect as vitestExpect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { NextIntlClientProvider } from "next-intl";
import { ProtocolStats } from "./protocol-stats";
import * as apiClient from "@/lib/api/client";
import type { ProtocolMetrics } from "@/lib/protocol";
import enMessages from "@/messages/en.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const expect = vitestExpect as any;

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("ProtocolStats Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders live stats when metrics are available", () => {
    vi.spyOn(apiClient, "fetchProtocol").mockReturnValue(new Promise(() => {}));

    const mockMetrics: ProtocolMetrics = {
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

  it("fetches and renders live stats from the validated API client", async () => {
    vi.spyOn(apiClient, "fetchProtocol").mockResolvedValue({
      totalSupply: "500000000000",
      totalBorrow: "125000000000",
      utilizationBps: "2500",
      ledger: 1234567,
      fetchedAt: "2026-10-19T12:00:00.000Z",
    });

    renderWithIntl(<ProtocolStats initialMetrics={null} />);

    const liveSection = await screen.findByTestId("protocol-stats-live");
    expect(liveSection).toBeInTheDocument();
    expect(screen.getByText("50,000 XLM")).toBeInTheDocument();
    expect(screen.getByText("12,500 XLM")).toBeInTheDocument();
    expect(screen.getByText("25.00%")).toBeInTheDocument();
    expect(screen.getByText("as of ledger 1234567")).toBeInTheDocument();
  });

  it("renders loading state when initialMetrics is not provided and fetching", () => {
    vi.spyOn(apiClient, "fetchProtocol").mockReturnValue(new Promise(() => {}));

    renderWithIntl(<ProtocolStats initialMetrics={null} />);

    expect(screen.getByTestId("protocol-stats-loading")).toBeInTheDocument();
  });

  it("keeps loading labels outside the pulsing placeholder and has no axe violations", async () => {
    vi.spyOn(apiClient, "fetchProtocol").mockReturnValue(new Promise(() => {}));

    const { container } = renderWithIntl(<ProtocolStats initialMetrics={null} />);
    const label = screen.getByText("Total supplied");

    expect(label.closest(".animate-pulse")).toBeNull();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders fallback state with demo data badge when API client rejects", async () => {
    vi.spyOn(apiClient, "fetchProtocol").mockRejectedValue(
      new apiClient.ApiClientError("INVALID_RESPONSE", "Malformed payload"),
    );

    renderWithIntl(<ProtocolStats initialMetrics={null} />);

    const fallbackSection = await screen.findByTestId("protocol-stats-fallback");
    expect(fallbackSection).toBeInTheDocument();
    expect(screen.getByTestId("demo-data-badge")).toBeInTheDocument();
    expect(screen.getByText("Demo data")).toBeInTheDocument();
  });
});
