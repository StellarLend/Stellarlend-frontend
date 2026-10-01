/**
 * Deterministic purchase state machine.
 *
 * All state transitions are declared in `types/marketplace.ts`
 * (`PURCHASE_ALLOWED_TRANSITIONS`). This module is the single gate that
 * decides whether an event may fire from a given state, so no caller can
 * accidentally create contradictory client state (e.g. double-submitting from
 * `submitting`, or "succeeding" a cancelled purchase). It is a pure reducer:
 * no I/O, no randomness -- every input maps to exactly one output.
 */

import { PURCHASE_ALLOWED_TRANSITIONS, type PurchaseEvent, type PurchaseState } from "@/types/marketplace";

export class PurchaseInvariantViolation extends Error {
  readonly state: PurchaseState;
  readonly event: PurchaseEvent;
  readonly allowed: PurchaseEvent[];

  constructor(state: PurchaseState, event: PurchaseEvent, allowed: PurchaseEvent[]) {
    super(
      `Transition '${event}' is not allowed from state '${state}'. Allowed: ${allowed.join(", ") || "(none)"}.`,
    );
    this.name = "PurchaseInvariantViolation";
    this.state = state;
    this.event = event;
    this.allowed = allowed;
  }
}

export function canApply(state: PurchaseState, event: PurchaseEvent): boolean {
  return PURCHASE_ALLOWED_TRANSITIONS[state]?.includes(event) ?? false;
}

export function allowedEvents(state: PurchaseState): PurchaseEvent[] {
  return PURCHASE_ALLOWED_TRANSITIONS[state] ?? [];
}

/**
 * Advance the machine. Returns the new state, throwing
 * `PurchaseInvariantViolation` if the transition is not declared.
 */
export function advance(state: PurchaseState, event: PurchaseEvent): PurchaseState {
  const transitions = allowedEvents(state);
  if (!transitions.includes(event)) {
    throw new PurchaseInvariantViolation(state, event, transitions);
  }

  switch (event) {
    case "VALIDATION_OK":
      return "submitting";
    case "VALIDATION_FAIL":
    case "SUBMIT_FAIL":
      return "failed";
    case "SUBMIT_OK":
    case "RECONCILE_OK":
      return "succeeded";
    case "SUBMIT_AMBIGUOUS":
      return "confirming";
    case "CONFIRM_RETRY":
      return "submitting";
    case "RECONCILE_UNKNOWN":
      // Recovery was inconclusive; we stay in `confirming` and require an
      // explicit user decision rather than silently retrying the action.
      return "confirming";
    case "RECONCILE_FAILED":
      return "failed";
    case "CANCEL":
      return "cancelled";
    case "RESET":
      return "idle";
    case "VALIDATE":
      return "validating";
  }

  // Unreachable: every PurchaseEvent is handled above.
  throw new Error(`Unhandled purchase event: ${event}`);
}

/** True while a submission/recovery is live and duplicate actions must be blocked. */
export function isInFlight(state: PurchaseState): boolean {
  return state === "validating" || state === "submitting" || state === "confirming";
}