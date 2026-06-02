// lib/security/input-sanitizer.test.ts
import { expect, test } from "vitest";
import { sanitizeInput } from "@/lib/security/input-sanitizer";
import fc from "fast-check";

// Helper regexes matching characters that should be stripped
const CONTROL_REGEX = /[\u0000-\u001F\u007F-\u009F]/;
const BIDI_REGEX = /[\u202A-\u202E\u2066-\u2069]/;

test("sanitizeInput strips control and bidi characters and normalizes NFC", () => {
  fc.assert(
    fc.property(fc.unicodeString(), (raw) => {
      const sanitized = sanitizeInput(raw);
      // Ensure no control chars remain
      expect(CONTROL_REGEX.test(sanitized)).toBe(false);
      // Ensure no bidi chars remain
      expect(BIDI_REGEX.test(sanitized)).toBe(false);
      // NFC normalization: string should be equal to its NFC form
      expect(sanitized).toBe(sanitized.normalize("NFC"));
    })
  );
});
