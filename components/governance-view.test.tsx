import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { GovernanceView } from "./governance-view";
import type { GovernanceSnapshot } from "@/lib/governance";

const ok = <T,>(value: T) => ({ ok: true as const, value });
const snapshot: GovernanceSnapshot = {
  admin: ok("GADMINADMINADMINADMINADMINADMINADMINADMINADMINADMINADMINAD"),
  guardian: ok(null),
  oracle: { ok: false, error: "x" },
  minBorrow: ok(10_000_000n),
  depositCap: ok(1_000_000_000n),
  borrowCap: ok(500n),
  closeFactorBps: ok(5000),
  liquidationThresholdBps: ok(8000),
  liquidationIncentiveBps: ok(500),
  rateParams: ok({ base_rate_bps: 200n }),
  maxFlashBps: ok(900),
  audit: ok([{ sequence: 2n, action: "<b>pause</b>", actor: "GBACTORACTORACTORACTOR", ledger: 20 }]),
};

describe("GovernanceView", () => {
  it("renders English labels, values, not set, unavailable, and audit entry count", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <GovernanceView snapshot={snapshot} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Governance & risk configuration" })).toBeTruthy();
    expect(screen.getByText("Roles")).toBeTruthy();
    expect(screen.getByText("not set")).toBeTruthy();
    expect(screen.getByText("unavailable")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText("9%")).toBeTruthy();
    expect(screen.getByText("1 tokens")).toBeTruthy();
    expect(screen.getByText("<b>pause</b>")).toBeTruthy();
    expect(screen.getByText("1 entry")).toBeTruthy();
  });

  it("renders Spanish heading and localized labels under es provider", () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <GovernanceView snapshot={snapshot} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Gobernanza y configuración de riesgos" })).toBeTruthy();
    expect(screen.getByText("Límites de suministro y préstamo")).toBeTruthy();
    expect(screen.getByText("sin configurar")).toBeTruthy();
    expect(screen.getByText("no disponible")).toBeTruthy();
    expect(screen.getByText("1 entrada")).toBeTruthy();
  });

  it("unknown previous value renders unknown", () => {
    const snapWithDiff: GovernanceSnapshot = {
      ...snapshot,
      audit: ok([
        {
          sequence: 1n,
          action: "update_params",
          actor: "GBACTORACTORACTORACTOR",
          ledger: 10,
          diffs: [
            {
              field: "base_rate_bps",
              prev: null,
              next: 300n,
              prevFormatted: "unknown",
              nextFormatted: "3%",
              direction: "unknown",
            },
          ],
        },
      ]),
    };
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <GovernanceView snapshot={snapWithDiff} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/unknown → 3%/)).toBeTruthy();
  });

  it("renders localized not-configured message when snapshot is null", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <GovernanceView snapshot={null} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Governance & risk configuration" })).toBeTruthy();
    expect(screen.getByText("Lending contract is not configured.")).toBeTruthy();

    rerender(
      <NextIntlClientProvider locale="es" messages={es}>
        <GovernanceView snapshot={null} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Gobernanza y configuración de riesgos" })).toBeTruthy();
    expect(screen.getByText("El contrato de préstamos no está configurado.")).toBeTruthy();
  });
});
