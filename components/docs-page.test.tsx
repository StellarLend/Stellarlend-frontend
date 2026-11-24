// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { DocsPage } from "@/components/docs-page";
import { getDocsData, type DocsData } from "@/lib/docs-data";
import { explorer } from "@/lib/config";
import { MARKETS, type Market } from "@/lib/markets";

function renderDocs(data: DocsData) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DocsPage data={data} />
    </NextIntlClientProvider>
  );
}

describe("DocsPage", () => {
  it("renders live values", async () => {
    const mockLiveMarkets: Market[] = MARKETS.map((m) =>
      m.symbol === "XLM"
        ? {
            ...m,
            ltvBps: 7550,
            liqThresholdBps: 8250,
            supplyCap: 50_000_000_0000000n,
            borrowCap: 25_000_000_0000000n,
            minBorrow: 50_000_000n,
            sources: {
              ltv: "chain",
              liqThreshold: "chain",
              supplyCap: "chain",
              borrowCap: "chain",
              depositCapRemaining: "chain",
              minBorrow: "chain",
              totalSupply: "demo",
              totalBorrow: "demo",
            },
          }
        : m
    );

    const data = await getDocsData(async () => mockLiveMarkets);
    const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
    data.contracts = [
      {
        key: "lending",
        contractId,
        explorerUrl: explorer.contract(contractId),
        source: "chain",
      },
      {
        key: "oracle",
        contractId: "",
        explorerUrl: null,
        source: "demo",
      },
    ];

    expect(data.source).toBe("chain");
    expect(data.rpcFailed).toBe(false);

    renderDocs(data);

    // Live formatted values from formatPercentFromBps & formatTokenDisplay
    expect(screen.getByText("75.50%")).toBeTruthy();
    expect(screen.getByText("82.50%")).toBeTruthy();
    expect(screen.getByText("50,000,000 XLM")).toBeTruthy();
    expect(screen.getByText("25,000,000 XLM")).toBeTruthy();
    expect(screen.getByText("5 XLM")).toBeTruthy();

    // Source badges
    expect(screen.getAllByText("source: chain").length).toBeGreaterThan(0);

    // Contract link uses explorer helper
    const link = screen.getByRole("link", { name: contractId });
    expect(link.getAttribute("href")).toBe(explorer.contract(contractId));

    // No RPC failure note
    expect(screen.queryByText(/could not load live values/i)).toBeNull();
  });

  it("falls back to static when rpc fails", async () => {
    const data = await getDocsData(async () => {
      throw new Error("RPC timeout");
    });

    expect(data.source).toBe("demo");
    expect(data.rpcFailed).toBe(true);
    expect(data.markets.length).toBe(MARKETS.length);

    renderDocs(data);

    // Visible fallback note
    const note = screen.getByRole("status");
    expect(note.textContent).toMatch(/could not load live values/i);

    // Static fallback values formatted with formatPercentFromBps (XLM default ltv = 0.7 -> 70.00%)
    expect(screen.getByText("70.00%")).toBeTruthy();
    expect(screen.getAllByText("80.00%").length).toBeGreaterThan(0);

    // Demo source badges
    expect(screen.getAllByText("source: demo").length).toBeGreaterThan(0);
  });

  it("lists every variable from .env.example", async () => {
    const envExample = fs.readFileSync(
      path.resolve(process.cwd(), ".env.example"),
      "utf8",
    );
    const vars = envExample
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=")[0].trim());

    const data = await getDocsData(async () => MARKETS);
    renderDocs(data);

    for (const v of vars) {
      expect(screen.getByText(new RegExp(`^${v}$`))).toBeTruthy();
    }
  });
});
