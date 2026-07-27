import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyToClipboard, type CopyResult } from "./clipboard";

function mockSecureContext(secure: boolean) {
  Object.defineProperty(window, "isSecureContext", {
    value: secure,
    writable: true,
    configurable: true,
  });
}

describe("copyToClipboard", () => {
  describe("with address validation", () => {
    it("rejects invalid Stellar addresses before attempting copy", async () => {
      const result = await copyToClipboard("not-a-stellar-key", true);

      expect(result).toEqual<CopyResult>({
        success: false,
        reason: "invalid_address",
      });
    });

    it("accepts valid G-addresses", async () => {
      mockSecureContext(true);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard(
        "GABCQZ2Q6YPRB5T2Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5A",
        true,
      );

      expect(result).toEqual<CopyResult>({ success: true });
      expect(writeText).toHaveBeenCalledWith(
        "GABCQZ2Q6YPRB5T2Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5A",
      );
    });
  });

  describe("without address validation", () => {
    it("copies any string without validating", async () => {
      mockSecureContext(true);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard("anything", false);

      expect(result).toEqual<CopyResult>({ success: true });
      expect(writeText).toHaveBeenCalledWith("anything");
    });
  });

  describe("async clipboard API present", () => {
    beforeEach(() => {
      mockSecureContext(true);
    });

    it("returns success when writeText resolves", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard("test-value");

      expect(result).toEqual<CopyResult>({ success: true });
      expect(writeText).toHaveBeenCalledWith("test-value");
    });

    it("falls back to execCommand when writeText rejects", async () => {
      const writeText = vi.fn().mockRejectedValue(new Error("denied"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      vi.spyOn(document, "execCommand").mockReturnValue(true);
      vi.spyOn(document, "createElement").mockImplementation(
        (tag: string) => {
          if (tag === "textarea") {
            return {
              value: "",
              select: vi.fn(),
              setSelectionRange: vi.fn(),
              setAttribute: vi.fn(),
              style: {},
            } as unknown as HTMLTextAreaElement;
          }
          return document.createElement(tag);
        },
      );

      const result = await copyToClipboard("fallback-test");

      expect(result).toEqual<CopyResult>({ success: true });
    });
  });

  describe("fallback via execCommand", () => {
    it("uses execCommand when clipboard API is absent", async () => {
      mockSecureContext(false);
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      vi.spyOn(document, "execCommand").mockReturnValue(true);
      vi.spyOn(document, "createElement").mockImplementation(
        (tag: string) => {
          if (tag === "textarea") {
            return {
              value: "",
              select: vi.fn(),
              setSelectionRange: vi.fn(),
              setAttribute: vi.fn(),
              style: {},
            } as unknown as HTMLTextAreaElement;
          }
          return document.createElement(tag);
        },
      );
      vi.spyOn(document.body, "appendChild").mockImplementation(vi.fn());
      vi.spyOn(document.body, "removeChild").mockImplementation(vi.fn());

      const result = await copyToClipboard("fallback-value");

      expect(result).toEqual<CopyResult>({ success: true });
      expect(document.execCommand).toHaveBeenCalledWith("copy");
    });

    it("returns clipboard_error when execCommand fails", async () => {
      mockSecureContext(false);
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      vi.spyOn(document, "execCommand").mockReturnValue(false);
      vi.spyOn(document, "createElement").mockImplementation(
        (tag: string) => {
          if (tag === "textarea") {
            return {
              value: "",
              select: vi.fn(),
              setSelectionRange: vi.fn(),
              setAttribute: vi.fn(),
              style: {},
            } as unknown as HTMLTextAreaElement;
          }
          return document.createElement(tag);
        },
      );
      vi.spyOn(document.body, "appendChild").mockImplementation(vi.fn());
      vi.spyOn(document.body, "removeChild").mockImplementation(vi.fn());

      const result = await copyToClipboard("will-fail");

      expect(result).toEqual<CopyResult>({
        success: false,
        reason: "clipboard_error",
      });
    });
  });
});
