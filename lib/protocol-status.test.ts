/**
 * lib/protocol-status.test.ts
 *
 * Tests for:
 *  1. decodeEmergencyStateFromStorage — encoding contract
 *  2. allowedActions — full (emergency × pause) matrix
 */

import { nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  allowedActions,
  decodeEmergencyStateFromStorage,
  type ActionName,
  type EmergencyState,
  type PauseFlags,
  type ProtocolStatus,
} from "./protocol-status";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noFlags: PauseFlags = {
  All: false,
  Supply: false,
  Borrow: false,
  Withdraw: false,
  Repay: false,
  Liquidate: false,
};

function ok(
  emergency: EmergencyState = "Normal",
  pauseOverrides: Partial<PauseFlags> = {}
): ProtocolStatus {
  return {
    kind: "ok",
    emergency,
    paused: { ...noFlags, ...pauseOverrides },
    ledger: 100,
  };
}

const ALL_ACTIONS = new Set<ActionName>([
  "supply",
  "withdraw",
  "borrow",
  "repay",
  "liquidate",
]);

// ---------------------------------------------------------------------------
// 1. ScVal encoding — explicit test that our key/value decoding is correct
// ---------------------------------------------------------------------------

describe("ScVal encoding for EmergencyState instance-storage key/value", () => {
  // The DataKey::EmergencyState unit enum variant must encode to
  // ScVal::Vec([Symbol("EmergencyState")]).  nativeToScVal(["EmergencyState"],
  // { type: ["symbol"] }) produces exactly that; scValToNative round-trips it
  // back to ["EmergencyState"].  This test pins the encoding so regressions
  // are caught before they reach prod.

  it('key encodes and round-trips as ["EmergencyState"]', () => {
    const scval = nativeToScVal(["EmergencyState"], { type: ["symbol"] });
    expect(scValToNative(scval)).toEqual(["EmergencyState"]);
  });

  it('Normal value encodes and round-trips as ["Normal"]', () => {
    const scval = nativeToScVal(["Normal"], { type: ["symbol"] });
    expect(scValToNative(scval)).toEqual(["Normal"]);
  });

  it('Shutdown value encodes and round-trips as ["Shutdown"]', () => {
    const scval = nativeToScVal(["Shutdown"], { type: ["symbol"] });
    expect(scValToNative(scval)).toEqual(["Shutdown"]);
  });

  it('Recovery value encodes and round-trips as ["Recovery"]', () => {
    const scval = nativeToScVal(["Recovery"], { type: ["symbol"] });
    expect(scValToNative(scval)).toEqual(["Recovery"]);
  });
});

// ---------------------------------------------------------------------------
// 2. decodeEmergencyStateFromStorage — with and without EmergencyState key
// ---------------------------------------------------------------------------

describe("decodeEmergencyStateFromStorage", () => {
  function entry(keyVariant: string, valVariant: string) {
    return {
      key: scValToNative(nativeToScVal([keyVariant], { type: ["symbol"] })),
      val: scValToNative(nativeToScVal([valVariant], { type: ["symbol"] })),
    };
  }

  it("returns Normal when storage is empty (mirrors get_emergency_state default)", () => {
    expect(decodeEmergencyStateFromStorage([])).toBe("Normal");
  });

  it("returns Normal when the EmergencyState key is absent (other keys present)", () => {
    expect(
      decodeEmergencyStateFromStorage([
        entry("InterestRateModel", "Linear"),
        entry("PauseAdmin", "GABC"),
      ])
    ).toBe("Normal");
  });

  it("decodes Normal variant", () => {
    expect(decodeEmergencyStateFromStorage([entry("EmergencyState", "Normal")])).toBe("Normal");
  });

  it("decodes Shutdown variant", () => {
    expect(decodeEmergencyStateFromStorage([entry("EmergencyState", "Shutdown")])).toBe("Shutdown");
  });

  it("decodes Recovery variant", () => {
    expect(decodeEmergencyStateFromStorage([entry("EmergencyState", "Recovery")])).toBe("Recovery");
  });

  it("defaults to Normal for an unrecognised variant", () => {
    expect(decodeEmergencyStateFromStorage([entry("EmergencyState", "FutureVariant")])).toBe("Normal");
  });

  it("finds the EmergencyState key when it is not the first entry", () => {
    expect(
      decodeEmergencyStateFromStorage([
        entry("TotalCollateral", "Linear"),
        entry("EmergencyState", "Recovery"),
        entry("Admin", "GABC"),
      ])
    ).toBe("Recovery");
  });

  it("handles null key entries without throwing", () => {
    expect(
      decodeEmergencyStateFromStorage([
        { key: null, val: null },
        entry("EmergencyState", "Shutdown"),
      ])
    ).toBe("Shutdown");
  });
});

// ---------------------------------------------------------------------------
// 3. allowedActions — full (emergency × pause) matrix
// ---------------------------------------------------------------------------

describe("allowedActions", () => {
  // --- RPC failure ---
  it("unknown (RPC failure) → all actions enabled, none disabled", () => {
    expect(allowedActions({ kind: "unknown", error: "timeout" })).toEqual(ALL_ACTIONS);
  });

  // --- Normal, no pauses ---
  it("Normal + no pauses → all actions", () => {
    expect(allowedActions(ok("Normal"))).toEqual(ALL_ACTIONS);
  });

  // --- Shutdown ---
  it("Shutdown → no actions (all disabled)", () => {
    expect(allowedActions(ok("Shutdown"))).toEqual(new Set());
  });

  it("Shutdown + some pauses → still no actions (Shutdown dominates)", () => {
    expect(
      allowedActions(ok("Shutdown", { Supply: true, Borrow: true }))
    ).toEqual(new Set());
  });

  // --- All pause ---
  it("Normal + All paused → no actions", () => {
    expect(allowedActions(ok("Normal", { All: true }))).toEqual(new Set());
  });

  it("Recovery + All paused → no actions (All pause after Shutdown check)", () => {
    expect(allowedActions(ok("Recovery", { All: true }))).toEqual(new Set());
  });

  // --- Recovery ---
  it("Recovery + no individual pauses → only withdraw, repay, liquidate", () => {
    expect(allowedActions(ok("Recovery"))).toEqual(
      new Set<ActionName>(["withdraw", "repay", "liquidate"])
    );
  });

  it("Recovery + Withdraw paused → only repay, liquidate", () => {
    expect(allowedActions(ok("Recovery", { Withdraw: true }))).toEqual(
      new Set<ActionName>(["repay", "liquidate"])
    );
  });

  it("Recovery + Repay paused → only withdraw, liquidate", () => {
    expect(allowedActions(ok("Recovery", { Repay: true }))).toEqual(
      new Set<ActionName>(["withdraw", "liquidate"])
    );
  });

  it("Recovery + Liquidate paused → only withdraw, repay", () => {
    expect(allowedActions(ok("Recovery", { Liquidate: true }))).toEqual(
      new Set<ActionName>(["withdraw", "repay"])
    );
  });

  it("Recovery + all three allowed ops paused → no actions", () => {
    expect(
      allowedActions(ok("Recovery", { Withdraw: true, Repay: true, Liquidate: true }))
    ).toEqual(new Set());
  });

  // Supply/Borrow already blocked by Recovery; individual pause redundant but harmless
  it("Recovery + Supply paused → same as Recovery alone (supply already blocked)", () => {
    expect(allowedActions(ok("Recovery", { Supply: true }))).toEqual(
      new Set<ActionName>(["withdraw", "repay", "liquidate"])
    );
  });

  // --- Normal, individual pauses ---
  it("Normal + Supply paused → withdraw, borrow, repay, liquidate", () => {
    expect(allowedActions(ok("Normal", { Supply: true }))).toEqual(
      new Set<ActionName>(["withdraw", "borrow", "repay", "liquidate"])
    );
  });

  it("Normal + Borrow paused → supply, withdraw, repay, liquidate", () => {
    expect(allowedActions(ok("Normal", { Borrow: true }))).toEqual(
      new Set<ActionName>(["supply", "withdraw", "repay", "liquidate"])
    );
  });

  it("Normal + Withdraw paused → supply, borrow, repay, liquidate", () => {
    expect(allowedActions(ok("Normal", { Withdraw: true }))).toEqual(
      new Set<ActionName>(["supply", "borrow", "repay", "liquidate"])
    );
  });

  it("Normal + Repay paused → supply, withdraw, borrow, liquidate", () => {
    expect(allowedActions(ok("Normal", { Repay: true }))).toEqual(
      new Set<ActionName>(["supply", "withdraw", "borrow", "liquidate"])
    );
  });

  it("Normal + Liquidate paused → supply, withdraw, borrow, repay", () => {
    expect(allowedActions(ok("Normal", { Liquidate: true }))).toEqual(
      new Set<ActionName>(["supply", "withdraw", "borrow", "repay"])
    );
  });

  it("Normal + Supply + Borrow paused → withdraw, repay, liquidate", () => {
    expect(
      allowedActions(ok("Normal", { Supply: true, Borrow: true }))
    ).toEqual(new Set<ActionName>(["withdraw", "repay", "liquidate"]));
  });

  it("Normal + all individual flags paused (no All) → no actions", () => {
    expect(
      allowedActions(
        ok("Normal", {
          Supply: true,
          Borrow: true,
          Withdraw: true,
          Repay: true,
          Liquidate: true,
        })
      )
    ).toEqual(new Set());
  });
});
