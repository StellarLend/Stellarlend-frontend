import { describe, it, expect } from "vitest";
import {
  COMMITMENT_AMOUNT_BOUNDS,
  INTEREST_RATE_BOUNDS,
  DURATION_BOUNDS,
  WALLET_BOUNDS,
  DraftState,
  FailureMode,
  VALID_STATE_TRANSITIONS,
  validateAmountInvariant,
  validateInterestRateInvariant,
  validateDurationInvariant,
  validateDraftIdInvariant,
  validateWalletAddressInvariant,
  validateStateTransition,
  calculateNextRetryDelay,
  isDataStale,
  validateDraftOperationInvariants,
} from "@/src/lib/commitment-creation-invariants";

describe("commitment-creation-invariants", () => {
  // =========================================================================
  // AMOUNT VALIDATION
  // =========================================================================

  describe("validateAmountInvariant", () => {
    it("accepts amount at minimum boundary", () => {
      expect(validateAmountInvariant(COMMITMENT_AMOUNT_BOUNDS.MIN_AMOUNT)).toBe(1);
    });

    it("accepts amount at maximum boundary", () => {
      const result = validateAmountInvariant(COMMITMENT_AMOUNT_BOUNDS.MAX_AMOUNT);
      expect(result).toBe(COMMITMENT_AMOUNT_BOUNDS.MAX_AMOUNT);
    });

    it("accepts string representation of amount", () => {
      expect(validateAmountInvariant("100.50")).toBe(100.5);
    });

    it("rejects zero amount", () => {
      expect(() => validateAmountInvariant(0)).toThrow(/below minimum/i);
    });

    it("rejects negative amount", () => {
      expect(() => validateAmountInvariant(-50)).toThrow(/below minimum/i);
    });

    it("rejects amount exceeding maximum", () => {
      expect(() =>
        validateAmountInvariant(COMMITMENT_AMOUNT_BOUNDS.MAX_AMOUNT + 1),
      ).toThrow(/exceeds maximum/i);
    });

    it("rejects non-numeric amount", () => {
      expect(() => validateAmountInvariant("not-a-number")).toThrow(
        /must be a finite number/i,
      );
    });

    it("rejects NaN", () => {
      expect(() => validateAmountInvariant(NaN)).toThrow(/must be a finite number/i);
    });

    it("rejects Infinity", () => {
      expect(() => validateAmountInvariant(Infinity)).toThrow(/must be a finite number/i);
    });
  });

  // =========================================================================
  // INTEREST RATE VALIDATION
  // =========================================================================

  describe("validateInterestRateInvariant", () => {
    it("accepts rate at minimum boundary", () => {
      expect(validateInterestRateInvariant(INTEREST_RATE_BOUNDS.MIN_RATE)).toBe(
        INTEREST_RATE_BOUNDS.MIN_RATE,
      );
    });

    it("accepts rate at maximum boundary", () => {
      expect(validateInterestRateInvariant(INTEREST_RATE_BOUNDS.MAX_RATE)).toBe(
        INTEREST_RATE_BOUNDS.MAX_RATE,
      );
    });

    it("accepts typical rate (12.5%)", () => {
      expect(validateInterestRateInvariant(12.5)).toBe(12.5);
    });

    it("rejects rate below minimum", () => {
      expect(() => validateInterestRateInvariant(0.05)).toThrow(/below minimum/i);
    });

    it("rejects rate above maximum", () => {
      expect(() => validateInterestRateInvariant(1001)).toThrow(/exceeds maximum/i);
    });

    it("rejects non-numeric rate", () => {
      expect(() => validateInterestRateInvariant("twelve percent")).toThrow(
        /must be a finite number/i,
      );
    });
  });

  // =========================================================================
  // DURATION VALIDATION
  // =========================================================================

  describe("validateDurationInvariant", () => {
    it("accepts duration at minimum boundary (1 day)", () => {
      expect(validateDurationInvariant(DURATION_BOUNDS.MIN_DAYS)).toBe(1);
    });

    it("accepts duration at maximum boundary (10 years)", () => {
      expect(validateDurationInvariant(DURATION_BOUNDS.MAX_DAYS)).toBe(
        DURATION_BOUNDS.MAX_DAYS,
      );
    });

    it("accepts typical duration (30 days)", () => {
      expect(validateDurationInvariant(30)).toBe(30);
    });

    it("rejects zero duration", () => {
      expect(() => validateDurationInvariant(0)).toThrow(/below minimum/i);
    });

    it("rejects negative duration", () => {
      expect(() => validateDurationInvariant(-5)).toThrow(/below minimum/i);
    });

    it("rejects duration exceeding 10 years", () => {
      expect(() => validateDurationInvariant(3651)).toThrow(/exceeds maximum/i);
    });

    it("rejects fractional days", () => {
      expect(() => validateDurationInvariant(30.5)).toThrow(/must be an integer/i);
    });

    it("accepts string representation of days", () => {
      expect(validateDurationInvariant("60")).toBe(60);
    });
  });

  // =========================================================================
  // DRAFT ID VALIDATION
  // =========================================================================

  describe("validateDraftIdInvariant", () => {
    it("accepts valid draft ID", () => {
      expect(validateDraftIdInvariant("draft-123")).toBe("draft-123");
    });

    it("accepts ID with underscores", () => {
      expect(validateDraftIdInvariant("draft_user_123")).toBe("draft_user_123");
    });

    it("accepts ID with only alphanumerics", () => {
      expect(validateDraftIdInvariant("abc123XYZ")).toBe("abc123XYZ");
    });

    it("rejects empty ID", () => {
      expect(() => validateDraftIdInvariant("")).toThrow(/cannot be empty/i);
    });

    it("rejects whitespace-only ID", () => {
      expect(() => validateDraftIdInvariant("   ")).toThrow(/cannot be empty/i);
    });

    it("rejects ID exceeding max length", () => {
      const tooLong = "a".repeat(129);
      expect(() => validateDraftIdInvariant(tooLong)).toThrow(/exceeds maximum length/i);
    });

    it("rejects ID with special characters", () => {
      expect(() => validateDraftIdInvariant("draft@123")).toThrow(
        /alphanumeric characters/i,
      );
    });

    it("rejects ID with spaces", () => {
      expect(() => validateDraftIdInvariant("draft 123")).toThrow(
        /alphanumeric characters/i,
      );
    });

    it("trims whitespace from ID", () => {
      expect(validateDraftIdInvariant("  draft-123  ")).toBe("draft-123");
    });
  });

  // =========================================================================
  // WALLET ADDRESS VALIDATION
  // =========================================================================

  describe("validateWalletAddressInvariant", () => {
    const validAddress = "G" + "A".repeat(55);

    it("accepts valid Stellar address", () => {
      expect(validateWalletAddressInvariant(validAddress)).toBe(validAddress);
    });

    it("rejects address not starting with G", () => {
      const invalid = "S" + "A".repeat(55);
      expect(() => validateWalletAddressInvariant(invalid)).toThrow(/must start with/i);
    });

    it("rejects address with wrong length", () => {
      const tooShort = "G" + "A".repeat(54);
      expect(() => validateWalletAddressInvariant(tooShort)).toThrow(
        /exactly.*characters/i,
      );
    });

    it("rejects address with invalid base32 characters", () => {
      const invalid = "G" + "A".repeat(54) + "0"; // 0 is not in Stellar base32
      expect(() => validateWalletAddressInvariant(invalid)).toThrow(/invalid characters/i);
    });

    it("rejects address with lowercase", () => {
      const invalid = "G" + "a".repeat(55);
      expect(() => validateWalletAddressInvariant(invalid)).toThrow(/invalid characters/i);
    });

    it("accepts address with valid base32 alphabet (A-Z, 2-7)", () => {
      const valid = "G" + "A".repeat(27) + "2".repeat(28);
      expect(() => validateWalletAddressInvariant(valid)).not.toThrow();
    });

    it("rejects empty address", () => {
      expect(() => validateWalletAddressInvariant("")).toThrow(/must start with/i);
    });
  });

  // =========================================================================
  // STATE TRANSITIONS
  // =========================================================================

  describe("validateStateTransition", () => {
    it("allows IDLE -> FETCHING", () => {
      expect(() =>
        validateStateTransition(DraftState.IDLE, DraftState.FETCHING),
      ).not.toThrow();
    });

    it("allows IDLE -> ACTIVE (new creation)", () => {
      expect(() =>
        validateStateTransition(DraftState.IDLE, DraftState.ACTIVE),
      ).not.toThrow();
    });

    it("allows FETCHING -> LOADED", () => {
      expect(() =>
        validateStateTransition(DraftState.FETCHING, DraftState.LOADED),
      ).not.toThrow();
    });

    it("allows FETCHING -> ERROR", () => {
      expect(() =>
        validateStateTransition(DraftState.FETCHING, DraftState.ERROR),
      ).not.toThrow();
    });

    it("allows ACTIVE -> PERSISTING", () => {
      expect(() =>
        validateStateTransition(DraftState.ACTIVE, DraftState.PERSISTING),
      ).not.toThrow();
    });

    it("allows PERSISTING -> ACTIVE (resume editing)", () => {
      expect(() =>
        validateStateTransition(DraftState.PERSISTING, DraftState.ACTIVE),
      ).not.toThrow();
    });

    it("allows ACTIVE -> SUBMITTING", () => {
      expect(() =>
        validateStateTransition(DraftState.ACTIVE, DraftState.SUBMITTING),
      ).not.toThrow();
    });

    it("allows SUBMITTING -> COMPLETED", () => {
      expect(() =>
        validateStateTransition(DraftState.SUBMITTING, DraftState.COMPLETED),
      ).not.toThrow();
    });

    it("rejects IDLE -> COMPLETED (must go through other states)", () => {
      expect(() =>
        validateStateTransition(DraftState.IDLE, DraftState.COMPLETED),
      ).toThrow(/Invalid state transition/);
    });

    it("rejects COMPLETED -> ACTIVE (terminal state)", () => {
      expect(() =>
        validateStateTransition(DraftState.COMPLETED, DraftState.ACTIVE),
      ).toThrow(/Invalid state transition/);
    });

    it("rejects CANCELLED -> IDLE (terminal state)", () => {
      expect(() =>
        validateStateTransition(DraftState.CANCELLED, DraftState.IDLE),
      ).toThrow(/Invalid state transition/);
    });
  });

  // =========================================================================
  // RETRY DELAY CALCULATION
  // =========================================================================

  describe("calculateNextRetryDelay", () => {
    it("uses initial delay for first attempt", () => {
      const delay = calculateNextRetryDelay(1);
      expect(delay).toBeGreaterThanOrEqual(900); // ~1000 with jitter
      expect(delay).toBeLessThanOrEqual(1100);
    });

    it("applies exponential backoff on retries", () => {
      const delay1 = calculateNextRetryDelay(1);
      const delay2 = calculateNextRetryDelay(2);
      const delay3 = calculateNextRetryDelay(3);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it("caps delay at maximum", () => {
      const delayAtHighAttempt = calculateNextRetryDelay(100);
      expect(delayAtHighAttempt).toBeLessThanOrEqual(30000);
    });

    it("adds jitter to prevent thundering herd", () => {
      const delays = Array.from({ length: 10 }, () => calculateNextRetryDelay(2));
      const unique = new Set(delays);
      // With jitter, we should get different values
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  // =========================================================================
  // STALE DATA DETECTION
  // =========================================================================

  describe("isDataStale", () => {
    it("considers null timestamp as stale", () => {
      expect(isDataStale(null)).toBe(true);
    });

    it("considers recent fetch as fresh", () => {
      const recentTime = Date.now() - 30000; // 30 seconds ago
      expect(isDataStale(recentTime)).toBe(false);
    });

    it("considers old fetch as stale", () => {
      const oldTime = Date.now() - 120000; // 2 minutes ago
      expect(isDataStale(oldTime)).toBe(true);
    });

    it("considers data at stale threshold as stale", () => {
      const atThreshold = Date.now() - 60000; // exactly 60 seconds ago
      expect(isDataStale(atThreshold)).toBe(true);
    });

    it("considers data just before threshold as fresh", () => {
      const justBefore = Date.now() - 59999; // just before 60 seconds
      expect(isDataStale(justBefore)).toBe(false);
    });
  });

  // =========================================================================
  // COMPOSITE VALIDATION
  // =========================================================================

  describe("validateDraftOperationInvariants", () => {
    it("accepts all valid invariants", () => {
      expect(() =>
        validateDraftOperationInvariants({
          amount: 100,
          interestRate: 12.5,
          duration: 30,
          collateralAmount: 150,
          draftId: "draft-123",
          walletAddress: "G" + "A".repeat(55),
          network: "TESTNET",
        }),
      ).not.toThrow();
    });

    it("validates amount if provided", () => {
      expect(() =>
        validateDraftOperationInvariants({
          amount: -100,
        }),
      ).toThrow(/below minimum/i);
    });

    it("validates interest rate if provided", () => {
      expect(() =>
        validateDraftOperationInvariants({
          interestRate: 2000,
        }),
      ).toThrow(/exceeds maximum/i);
    });

    it("validates duration if provided", () => {
      expect(() =>
        validateDraftOperationInvariants({
          duration: 0,
        }),
      ).toThrow(/below minimum/i);
    });

    it("validates network if provided", () => {
      expect(() =>
        validateDraftOperationInvariants({
          network: "INVALID",
        }),
      ).toThrow(/Unsupported network/i);
    });

    it("ignores undefined fields", () => {
      expect(() =>
        validateDraftOperationInvariants({
          amount: 100,
          interestRate: undefined,
          duration: undefined,
        }),
      ).not.toThrow();
    });
  });

  // =========================================================================
  // BOUNDS CONSTANTS
  // =========================================================================

  describe("bounds constants", () => {
    it("has sensible amount bounds", () => {
      expect(COMMITMENT_AMOUNT_BOUNDS.MIN_AMOUNT).toBe(1);
      expect(COMMITMENT_AMOUNT_BOUNDS.MAX_AMOUNT).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("has sensible interest rate bounds", () => {
      expect(INTEREST_RATE_BOUNDS.MIN_RATE).toBeLessThan(
        INTEREST_RATE_BOUNDS.MAX_RATE,
      );
    });

    it("has sensible duration bounds", () => {
      expect(DURATION_BOUNDS.MIN_DAYS).toBe(1);
      expect(DURATION_BOUNDS.MAX_DAYS).toBe(3650); // 10 years
    });

    it("has valid wallet networks", () => {
      expect(WALLET_BOUNDS.VALID_NETWORKS.has("PUBLIC")).toBe(true);
      expect(WALLET_BOUNDS.VALID_NETWORKS.has("TESTNET")).toBe(true);
    });
  });

  // =========================================================================
  // STATE MACHINE GRAPH
  // =========================================================================

  describe("VALID_STATE_TRANSITIONS", () => {
    it("defines transitions from all states", () => {
      Object.values(DraftState).forEach((state) => {
        expect(VALID_STATE_TRANSITIONS[state]).toBeDefined();
      });
    });

    it("has no transitions from terminal states (COMPLETED, CANCELLED)", () => {
      expect(VALID_STATE_TRANSITIONS[DraftState.COMPLETED]).toHaveLength(0);
      expect(VALID_STATE_TRANSITIONS[DraftState.CANCELLED]).toHaveLength(0);
    });

    it("allows recovery from ERROR state", () => {
      const errorTransitions = VALID_STATE_TRANSITIONS[DraftState.ERROR];
      expect(errorTransitions.some((s) => [DraftState.FETCHING, DraftState.IDLE].includes(s))).toBe(true);
    });
  });
});
