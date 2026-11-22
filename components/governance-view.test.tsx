import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  it("renders labels, values, not set and unavailable", () => {
    render(<GovernanceView snapshot={snapshot} />);
    expect(screen.getByText("Roles")).toBeTruthy();
    expect(screen.getByText("not set")).toBeTruthy();
    expect(screen.getByText("unavailable")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText("9%")).toBeTruthy();
    expect(screen.getByText("1 tokens")).toBeTruthy();
    expect(screen.getByText("<b>pause</b>")).toBeTruthy();
  });
});
