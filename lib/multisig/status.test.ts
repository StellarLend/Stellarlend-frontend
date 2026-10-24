// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  effectiveStatus,
  getStatusDisplay,
  estimateProposalExpiry,
} from "./status";
import { ProposalStatus } from "./types";

describe("Multisig Effective Status & Expiry", () => {
  const expiresAtLedger = 1000;
  const beforeLedger = 999;
  const equalLedger = 1000;
  const afterLedger = 1001;

  describe("effectiveStatus across all statuses and ledger positions", () => {
    describe("Active status", () => {
      it("returns Active before expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Active", expiresAtLedger },
            beforeLedger
          )
        ).toBe("Active");
      });

      it("returns Active at expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Active", expiresAtLedger },
            equalLedger
          )
        ).toBe("Active");
      });

      it("returns Expired after expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Active", expiresAtLedger },
            afterLedger
          )
        ).toBe("Expired");
      });
    });

    describe("Passed status", () => {
      it("returns Passed before expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Passed", expiresAtLedger },
            beforeLedger
          )
        ).toBe("Passed");
      });

      it("returns Passed at expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Passed", expiresAtLedger },
            equalLedger
          )
        ).toBe("Passed");
      });

      it("returns Expired after expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Passed", expiresAtLedger },
            afterLedger
          )
        ).toBe("Expired");
      });
    });

    describe("Executed status", () => {
      it("returns Executed before expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Executed", expiresAtLedger },
            beforeLedger
          )
        ).toBe("Executed");
      });

      it("returns Executed at expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Executed", expiresAtLedger },
            equalLedger
          )
        ).toBe("Executed");
      });

      it("returns Executed even after expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Executed", expiresAtLedger },
            afterLedger
          )
        ).toBe("Executed");
      });
    });

    describe("Cancelled status", () => {
      it("returns Cancelled before expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Cancelled", expiresAtLedger },
            beforeLedger
          )
        ).toBe("Cancelled");
      });

      it("returns Cancelled at expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Cancelled", expiresAtLedger },
            equalLedger
          )
        ).toBe("Cancelled");
      });

      it("returns Cancelled even after expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Cancelled", expiresAtLedger },
            afterLedger
          )
        ).toBe("Cancelled");
      });
    });

    describe("Expired status", () => {
      it("returns Expired before expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Expired", expiresAtLedger },
            beforeLedger
          )
        ).toBe("Expired");
      });

      it("returns Expired at expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Expired", expiresAtLedger },
            equalLedger
          )
        ).toBe("Expired");
      });

      it("returns Expired after expires_at", () => {
        expect(
          effectiveStatus(
            { status: "Expired", expiresAtLedger },
            afterLedger
          )
        ).toBe("Expired");
      });
    });
  });

  describe("getStatusDisplay", () => {
    it("formats overridden display when stored status is Active but effective status is Expired", () => {
      const display = getStatusDisplay(
        { status: "Active", expiresAtLedger },
        afterLedger
      );
      expect(display.isOverridden).toBe(true);
      expect(display.storedStatus).toBe("Active");
      expect(display.effectiveStatus).toBe("Expired");
      expect(display.displayText).toBe("stored: Active · effective: Expired");
    });

    it("formats overridden display when stored status is Passed but effective status is Expired", () => {
      const display = getStatusDisplay(
        { status: "Passed", expiresAtLedger },
        afterLedger
      );
      expect(display.isOverridden).toBe(true);
      expect(display.storedStatus).toBe("Passed");
      expect(display.effectiveStatus).toBe("Expired");
      expect(display.displayText).toBe("stored: Passed · effective: Expired");
    });

    it("formats standard display when not overridden", () => {
      const display = getStatusDisplay(
        { status: "Active", expiresAtLedger },
        beforeLedger
      );
      expect(display.isOverridden).toBe(false);
      expect(display.displayText).toBe("Active");
    });
  });

  describe("estimateProposalExpiry", () => {
    it("returns formatted seconds estimate when expiry is imminent (< 60s)", () => {
      const estimate = estimateProposalExpiry(1010, 1000, 5);
      expect(estimate.isExpired).toBe(false);
      expect(estimate.ledgersRemaining).toBe(10);
      expect(estimate.estimatedSecondsRemaining).toBe(50);
      expect(estimate.formattedEstimate).toBe("~50s (approx.)");
    });

    it("returns formatted minutes estimate when within an hour", () => {
      // 120 ledgers * 5s = 600s = 10 mins
      const estimate = estimateProposalExpiry(1120, 1000, 5);
      expect(estimate.isExpired).toBe(false);
      expect(estimate.formattedEstimate).toBe("~10m (approx.)");
    });

    it("returns formatted hours estimate when within a day", () => {
      // 1500 ledgers * 5s = 7500s = 2h 5m
      const estimate = estimateProposalExpiry(2500, 1000, 5);
      expect(estimate.isExpired).toBe(false);
      expect(estimate.formattedEstimate).toBe("~2h 5m (approx.)");
    });

    it("returns formatted days estimate when over a day away", () => {
      // 20000 ledgers * 5s = 100000s = ~1d 4h
      const estimate = estimateProposalExpiry(21000, 1000, 5);
      expect(estimate.isExpired).toBe(false);
      expect(estimate.formattedEstimate).toContain("~1d");
    });

    it("returns Expired when currentLedger >= expiresAtLedger", () => {
      const estimate = estimateProposalExpiry(1000, 1000, 5);
      expect(estimate.isExpired).toBe(true);
      expect(estimate.formattedEstimate).toBe("Expired");

      const pastEstimate = estimateProposalExpiry(1000, 1050, 5);
      expect(pastEstimate.isExpired).toBe(true);
      expect(pastEstimate.formattedEstimate).toBe("Expired");
    });
  });
});
