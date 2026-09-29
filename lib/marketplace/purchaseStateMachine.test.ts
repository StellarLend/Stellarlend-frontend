import { describe, it, expect } from "vitest";
import {
  PurchaseInvariantViolation,
  advance,
  allowedEvents,
  canApply,
  isInFlight,
} from "./purchaseStateMachine";
import type { PurchaseEvent, PurchaseState } from "@/types/marketplace";

describe("purchase state machine", () => {
  it("walks the happy path idle -> validating -> submitting -> succeeded", () => {
    let state: PurchaseState = "idle";
    state = advance(state, "VALIDATE");
    expect(state).toBe("validating");
    state = advance(state, "VALIDATION_OK");
    expect(state).toBe("submitting");
    state = advance(state, "SUBMIT_OK");
    expect(state).toBe("succeeded");
    expect(isInFlight(state)).toBe(false);
  });

  it("enters confirming on an ambiguous submission and requires explicit recovery", () => {
    let state: PurchaseState = "submitting";
    state = advance(state, "SUBMIT_AMBIGUOUS");
    expect(state).toBe("confirming");
    expect(isInFlight(state)).toBe(true);

    // Inconclusive recovery keeps the machine confirming (no silent retry).
    state = advance(state, "RECONCILE_UNKNOWN");
    expect(state).toBe("confirming");

    // The only way back to submitting is an explicit user-triggered retry.
    state = advance(state, "CONFIRM_RETRY");
    expect(state).toBe("submitting");
    state = advance(state, "SUBMIT_OK");
    expect(state).toBe("succeeded");
  });

  it("recovers to an authoritative success or failure from confirming", () => {
    expect(advance("confirming", "RECONCILE_OK")).toBe("succeeded");
    expect(advance("confirming", "RECONCILE_FAILED")).toBe("failed");
  });

  it("fails a validation error immediately", () => {
    expect(advance("validating", "VALIDATION_FAIL")).toBe("failed");
  });

  it("allows cancel from any in-flight state and reset from terminal states", () => {
    expect(advance("validating", "CANCEL")).toBe("cancelled");
    expect(advance("submitting", "CANCEL")).toBe("cancelled");
    expect(advance("confirming", "CANCEL")).toBe("cancelled");
    expect(advance("succeeded", "RESET")).toBe("idle");
    expect(advance("failed", "RESET")).toBe("idle");
    expect(advance("cancelled", "RESET")).toBe("idle");
  });

  it("rejects duplicate submissions from an in-flight state", () => {
    // A second VALIDATE while submitting is not a declared transition.
    const allowed = allowedEvents("submitting");
    expect(allowed).not.toContain("VALIDATE");
    expect(() => advance("submitting", "VALIDATE")).toThrow(PurchaseInvariantViolation);
    expect(canApply("submitting", "VALIDATE")).toBe(false);
  });

  it("forbids succeeding a cancelled purchase", () => {
    expect(() => advance("cancelled", "SUBMIT_OK")).toThrow(PurchaseInvariantViolation);
  });

  it("exposes the allowed events for a state", () => {
    const events = new Set<PurchaseEvent>(allowedEvents("idle"));
    expect(events.has("VALIDATE")).toBe(true);
    expect(events.has("SUBMIT_OK")).toBe(false);
  });
});