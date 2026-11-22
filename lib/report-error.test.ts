import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  reportError,
  redactStellarIds,
  sanitizeContext,
  setErrorSink,
  restoreDefaultErrorSink,
  resetReportedErrors,
  type ReportedErrorPayload,
} from "./report-error";

describe("report-error", () => {
  beforeEach(() => {
    resetReportedErrors();
    restoreDefaultErrorSink();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    restoreDefaultErrorSink();
    resetReportedErrors();
  });

  describe("redactStellarIds", () => {
    it("redacts standard Stellar 56-character G... public keys", () => {
      const address = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
      const message = `Failed to fetch balance for account ${address}`;
      const redacted = redactStellarIds(message);
      expect(redacted).toBe("Failed to fetch balance for account GA5Z...KZVN");
      expect(redacted).not.toContain(address);
    });

    it("redacts standard Stellar 56-character C... contract IDs", () => {
      const contractId = "CA3D5KRYMCMCZVAC7OHQHG262CX7JHW4U25OGOETJGDQJJTVOHGARHQE";
      const message = `Contract invocation failed on ${contractId}`;
      const redacted = redactStellarIds(message);
      expect(redacted).toBe("Contract invocation failed on CA3D...RHQE");
      expect(redacted).not.toContain(contractId);
    });

    it("leaves text without Stellar IDs untouched", () => {
      const text = "A normal error message with numbers 12345 and words";
      expect(redactStellarIds(text)).toBe(text);
    });
  });

  describe("sanitizeContext", () => {
    it("recursively sanitizes strings, objects, and arrays in context", () => {
      const address = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
      const contractId = "CA3D5KRYMCMCZVAC7OHQHG262CX7JHW4U25OGOETJGDQJJTVOHGARHQE";
      const context = {
        route: "/markets",
        walletConnected: true,
        user: {
          address,
        },
        contracts: [contractId, "other"],
        numericVal: 42,
      };

      const sanitized = sanitizeContext(context);
      expect(sanitized).toEqual({
        route: "/markets",
        walletConnected: true,
        user: {
          address: "GA5Z...KZVN",
        },
        contracts: ["CA3D...RHQE", "other"],
        numericVal: 42,
      });
    });
  });

  describe("reportError", () => {
    it("reports an error to the plugged error sink", () => {
      const sink = vi.fn();
      setErrorSink(sink);

      const error = new Error("Something broke");
      reportError(error, { route: "/markets" });

      expect(sink).toHaveBeenCalledTimes(1);
      const payload: ReportedErrorPayload = sink.mock.calls[0][0];
      expect(payload.name).toBe("Error");
      expect(payload.message).toBe("Something broke");
      expect(payload.context.route).toBe("/markets");
      expect(typeof payload.timestamp).toBe("string");
    });

    it("deduplicates identical errors in the same session", () => {
      const sink = vi.fn();
      setErrorSink(sink);

      const error = new Error("Duplicate error");
      reportError(error, { route: "/markets" });
      reportError(error, { route: "/markets" });
      reportError(error, { route: "/markets" });

      expect(sink).toHaveBeenCalledTimes(1);
    });

    it("redacts addresses before calling sink and before deduplication", () => {
      const sink = vi.fn();
      setErrorSink(sink);

      const addr1 = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
      const error = new Error(`Error with ${addr1}`);
      reportError(error, { address: addr1 });

      expect(sink).toHaveBeenCalledTimes(1);
      const payload = sink.mock.calls[0][0];
      expect(payload.message).toContain("GA5Z...KZVN");
      expect(payload.message).not.toContain(addr1);
      expect(payload.context.address).toBe("GA5Z...KZVN");
    });

    it("handles non-Error objects safely", () => {
      const sink = vi.fn();
      setErrorSink(sink);

      reportError("string error");
      expect(sink).toHaveBeenCalledTimes(1);
      expect(sink.mock.calls[0][0].message).toBe("string error");

      reportError({ custom: "data" });
      expect(sink).toHaveBeenCalledTimes(2);
      expect(sink.mock.calls[1][0].message).toContain("custom");
    });

    it("never throws if sink throws an exception", () => {
      const throwingSink = vi.fn().mockImplementation(() => {
        throw new Error("Sink exploded!");
      });
      setErrorSink(throwingSink);

      expect(() => {
        reportError(new Error("Test crash"));
      }).not.toThrow();
    });

    it("never throws if async sink returns a rejected promise", async () => {
      const rejectingSink = vi.fn().mockRejectedValue(new Error("Network failed"));
      setErrorSink(rejectingSink);

      expect(() => {
        reportError(new Error("Async test crash"));
      }).not.toThrow();
    });

    it("uses navigator.sendBeacon when endpoint is configured", () => {
      const originalEnv = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
      process.env.NEXT_PUBLIC_ERROR_ENDPOINT = "https://errors.example.com/log";

      const sendBeaconMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("navigator", {
        sendBeacon: sendBeaconMock,
      });

      try {
        reportError(new Error("Beacon test error"));
        expect(sendBeaconMock).toHaveBeenCalledTimes(1);
        expect(sendBeaconMock.mock.calls[0][0]).toBe("https://errors.example.com/log");
      } finally {
        process.env.NEXT_PUBLIC_ERROR_ENDPOINT = originalEnv;
        vi.unstubAllGlobals();
      }
    });

    it("falls back to fetch when navigator.sendBeacon returns false", () => {
      const originalEnv = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
      process.env.NEXT_PUBLIC_ERROR_ENDPOINT = "https://errors.example.com/log";

      const sendBeaconMock = vi.fn().mockReturnValue(false);
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("navigator", {
        sendBeacon: sendBeaconMock,
      });
      vi.stubGlobal("fetch", fetchMock);

      try {
        reportError(new Error("Fetch fallback test"));
        expect(sendBeaconMock).toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe("https://errors.example.com/log");
      } finally {
        process.env.NEXT_PUBLIC_ERROR_ENDPOINT = originalEnv;
        vi.unstubAllGlobals();
      }
    });
  });
});
