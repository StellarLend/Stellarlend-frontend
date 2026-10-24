import { describe, expect, it } from "vitest";
import { getGovernanceSnapshot, type ContractReader } from "./governance";

const ADMIN = "GADMINADMINADMINADMINADMINADMINADMINADMINADMINADMINADMINAD";
const responses: Record<string, unknown> = {
  get_admin: ADMIN,
  get_guardian: null,
  get_oracle: "GORACLE",
  get_min_borrow: 10_000_000n,
  get_deposit_cap: 1_000_000_000_000n,
  get_borrow_cap: 500n,
  get_close_factor: 5000,
  get_liquidation_threshold: 8000,
  get_liquidation_incentive: 500,
  get_rate_params: { base_rate_bps: 200n, kink_bps: 8000n, slope: 3n, label: "x" },
  get_max_flash_bps: 900,
  get_governance_audit_entries: [
    { sequence: 1n, action: "set_admin", actor: "GA", ledger: 10 },
    { sequence: 3n, action: "<b>x</b>", actor: "GB", ledger: 30 },
    { sequence: 2n, action: "pause", actor: "GC", ledger: 20 },
  ],
};

const reader = (overrides: Record<string, () => unknown> = {}): ContractReader => async (method) => {
  if (overrides[method]) return overrides[method]();
  return responses[method];
};

describe("getGovernanceSnapshot", () => {
  it("decodes every getter", async () => {
    const s = await getGovernanceSnapshot(reader());
    expect(s.admin).toEqual({ ok: true, value: ADMIN });
    expect(s.minBorrow).toEqual({ ok: true, value: 10_000_000n });
    expect(s.maxFlashBps).toEqual({ ok: true, value: 900 });
    expect(s.liquidationThresholdBps).toEqual({ ok: true, value: 8000 });
  });
  it("decodes RateParams struct (numeric fields only)", async () => {
    const s = await getGovernanceSnapshot(reader());
    expect(s.rateParams).toEqual({ ok: true, value: { base_rate_bps: 200n, kink_bps: 8000n, slope: 3n } });
  });
  it("treats Option::None as null", async () => {
    const s = await getGovernanceSnapshot(reader());
    expect(s.guardian).toEqual({ ok: true, value: null });
  });
  it("isolates a failing getter", async () => {
    const s = await getGovernanceSnapshot(reader({ get_deposit_cap: () => { throw new Error("boom"); } }));
    expect(s.depositCap.ok).toBe(false);
    expect(s.admin.ok).toBe(true);
  });
  it("sorts audit entries newest first and makes one audit call", async () => {
    let auditCalls = 0;
    const s = await getGovernanceSnapshot(reader({ get_governance_audit_entries: () => { auditCalls++; return responses.get_governance_audit_entries; } }));
    expect(auditCalls).toBe(1);
    expect(s.audit.ok && s.audit.value.map((e) => e.sequence)).toEqual([3n, 2n, 1n]);
  });
});
