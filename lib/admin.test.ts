import { describe, it, expect } from "vitest";
import {
  computeRole,
  getAllowedTransitions,
  isTransitionAllowed,
  hoursToLedgers,
  computeExpiresAtLedger,
  encodePauseTypeScVal,
  encodeEmergencyStateScVal,
  PAUSE_TYPES,
  EMERGENCY_STATES,
  MAX_U32,
} from "./admin";
import { scValToNative } from "@stellar/stellar-sdk";

describe("admin unit tests", () => {
  const ADMIN_ADDR = "GAH5NAPXT6T4Z6VUGGVIVTUT6I6JNDMBTKA4VYIUYZLTNZ2FW6NRGLJX";
  const GUARDIAN_ADDR = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  const RANDOM_ADDR = "GCAXMWJV4E44P6G4P6HVR6EQSDFL6H4B2T4H7WQLU3Q2PQX45ZNMTEST";

  describe("computeRole", () => {
    it("returns 'admin' when connected address equals admin address", () => {
      expect(computeRole(ADMIN_ADDR, ADMIN_ADDR, GUARDIAN_ADDR)).toBe("admin");
    });

    it("returns 'guardian' when connected address equals guardian address", () => {
      expect(computeRole(GUARDIAN_ADDR, ADMIN_ADDR, GUARDIAN_ADDR)).toBe("guardian");
    });

    it("returns 'none' when connected address is random user", () => {
      expect(computeRole(RANDOM_ADDR, ADMIN_ADDR, GUARDIAN_ADDR)).toBe("none");
    });

    it("returns 'none' when no address is connected", () => {
      expect(computeRole(null, ADMIN_ADDR, GUARDIAN_ADDR)).toBe("none");
      expect(computeRole(undefined, ADMIN_ADDR, GUARDIAN_ADDR)).toBe("none");
    });

    it("prioritizes admin if both match (edge case)", () => {
      expect(computeRole(ADMIN_ADDR, ADMIN_ADDR, ADMIN_ADDR)).toBe("admin");
    });
  });

  describe("allowed transitions matrix", () => {
    it("allows Admin to transition to Normal, Shutdown, and Recovery", () => {
      const allowed = getAllowedTransitions("admin");
      expect(allowed).toEqual(["Normal", "Shutdown", "Recovery"]);
      expect(isTransitionAllowed("admin", "Normal")).toBe(true);
      expect(isTransitionAllowed("admin", "Shutdown")).toBe(true);
      expect(isTransitionAllowed("admin", "Recovery")).toBe(true);
    });

    it("restricts Guardian to Shutdown only", () => {
      const allowed = getAllowedTransitions("guardian");
      expect(allowed).toEqual(["Shutdown"]);
      expect(isTransitionAllowed("guardian", "Shutdown")).toBe(true);
      expect(isTransitionAllowed("guardian", "Normal")).toBe(false);
      expect(isTransitionAllowed("guardian", "Recovery")).toBe(false);
    });

    it("disallows all transitions for 'none' role", () => {
      const allowed = getAllowedTransitions("none");
      expect(allowed).toEqual([]);
      expect(isTransitionAllowed("none", "Shutdown")).toBe(false);
      expect(isTransitionAllowed("none", "Normal")).toBe(false);
      expect(isTransitionAllowed("none", "Recovery")).toBe(false);
    });
  });

  describe("hoursToLedgers", () => {
    it("converts 1 hour to 720 ledgers (~5s per ledger)", () => {
      expect(hoursToLedgers(1)).toBe(720);
    });

    it("converts 24 hours to 17280 ledgers", () => {
      expect(hoursToLedgers(24)).toBe(17280);
    });

    it("returns 0 for negative or zero hours", () => {
      expect(hoursToLedgers(0)).toBe(0);
      expect(hoursToLedgers(-5)).toBe(0);
      expect(hoursToLedgers(NaN)).toBe(0);
    });

    it("clamps large values to u32 max", () => {
      expect(hoursToLedgers(100000000)).toBe(MAX_U32);
    });
  });

  describe("computeExpiresAtLedger", () => {
    it("sums current ledger and ttl ledgers", () => {
      expect(computeExpiresAtLedger(1000, 720)).toBe(1720);
    });

    it("clamps overflow to u32 max", () => {
      expect(computeExpiresAtLedger(MAX_U32 - 10, 20)).toBe(MAX_U32);
    });
  });

  describe("ScVal encoding", () => {
    it("encodes PauseType as ScVal vec with symbol for all variants", () => {
      for (const pt of PAUSE_TYPES) {
        const scVal = encodePauseTypeScVal(pt);
        const raw = scVal as any;
        expect(raw.switch().name).toBe("scvVec");
        const rawVec = raw.value();
        expect(rawVec.length).toBe(1);
        expect(rawVec[0].switch().name).toBe("scvSymbol");
        expect(rawVec[0].value().toString()).toBe(pt);
        expect(scValToNative(scVal)).toEqual([pt]);
      }
    });

    it("encodes EmergencyState as ScVal vec with symbol for all variants", () => {
      for (const st of EMERGENCY_STATES) {
        const scVal = encodeEmergencyStateScVal(st);
        const raw = scVal as any;
        expect(raw.switch().name).toBe("scvVec");
        const rawVec = raw.value();
        expect(rawVec.length).toBe(1);
        expect(rawVec[0].switch().name).toBe("scvSymbol");
        expect(rawVec[0].value().toString()).toBe(st);
        expect(scValToNative(scVal)).toEqual([st]);
      }
    });
  });
});
