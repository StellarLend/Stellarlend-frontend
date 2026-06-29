import { describe, it, expect } from "vitest";
import {
  localeSchema,
  displayCurrencySchema,
  notificationPreferencesSchema,
  preferencesSchema,
  validatePreferences,
} from "./preferences-validation";

describe("preferences-validation", () => {
  /* ── localeSchema ───────────────────────────────────────── */
  describe("localeSchema", () => {
    it.each([
      "en-US", "es", "fr", "ja", "zh-CN", "ko", "pt-BR", "de", "it", "ru", "ar",
    ])("accepts valid locale '%s'", (locale) => {
      expect(localeSchema.parse(locale)).toBe(locale);
    });

    it("rejects an invalid locale", () => {
      const result = localeSchema.safeParse("xx-XX");
      expect(result.success).toBe(false);
    });

    it("rejects a number", () => {
      const result = localeSchema.safeParse(42);
      expect(result.success).toBe(false);
    });

    it("rejects null", () => {
      const result = localeSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });

  /* ── displayCurrencySchema ──────────────────────────────── */
  describe("displayCurrencySchema", () => {
    it.each([
      "USD", "EUR", "JPY", "GBP", "XLM", "BTC", "ETH", "CNY", "KRW", "BRL",
    ])("accepts valid currency '%s'", (currency) => {
      expect(displayCurrencySchema.parse(currency)).toBe(currency);
    });

    it("rejects an invalid currency code", () => {
      const result = displayCurrencySchema.safeParse("ABC");
      expect(result.success).toBe(false);
    });

    it("rejects a lowercase variant", () => {
      const result = displayCurrencySchema.safeParse("usd");
      expect(result.success).toBe(false);
    });
  });

  /* ── notificationPreferencesSchema ──────────────────────── */
  describe("notificationPreferencesSchema", () => {
    it("applies defaults when given an empty object", () => {
      const result = notificationPreferencesSchema.parse({});
      expect(result).toEqual({
        email: true,
        push: true,
        sms: false,
        inApp: true,
      });
    });

    it("preserves explicit values", () => {
      const input = { email: false, push: false, sms: true, inApp: false };
      const result = notificationPreferencesSchema.parse(input);
      expect(result).toEqual(input);
    });

    it("fills missing fields with defaults", () => {
      const result = notificationPreferencesSchema.parse({ sms: true });
      expect(result).toEqual({
        email: true,
        push: true,
        sms: true,
        inApp: true,
      });
    });

    it("rejects a non-boolean value for a toggle", () => {
      const result = notificationPreferencesSchema.safeParse({ email: "yes" });
      expect(result.success).toBe(false);
    });
  });

  /* ── preferencesSchema ──────────────────────────────────── */
  describe("preferencesSchema", () => {
    it("applies all defaults for an empty object", () => {
      const result = preferencesSchema.parse({});
      expect(result).toEqual({
        locale: "en-US",
        displayCurrency: "USD",
        notifications: {
          email: true,
          push: true,
          sms: false,
          inApp: true,
        },
      });
    });

    it("preserves explicitly set valid fields", () => {
      const input = {
        email: "user@example.com",
        locale: "ja",
        displayCurrency: "JPY",
        notifications: { email: false, push: true, sms: true, inApp: false },
      };
      const result = preferencesSchema.parse(input);
      expect(result).toEqual(input);
    });

    it("applies notification defaults when notifications is undefined (preprocess branch)", () => {
      const result = preferencesSchema.parse({
        locale: "fr",
        displayCurrency: "EUR",
      });
      expect(result.notifications).toEqual({
        email: true,
        push: true,
        sms: false,
        inApp: true,
      });
    });

    it("applies notification defaults when notifications is an empty object", () => {
      const result = preferencesSchema.parse({ notifications: {} });
      expect(result.notifications).toEqual({
        email: true,
        push: true,
        sms: false,
        inApp: true,
      });
    });

    it("handles partial notifications object", () => {
      const result = preferencesSchema.parse({
        notifications: { sms: true },
      });
      expect(result.notifications).toEqual({
        email: true,
        push: true,
        sms: true,
        inApp: true,
      });
    });

    it("accepts an empty email string", () => {
      const result = preferencesSchema.parse({ email: "" });
      expect(result.email).toBe("");
    });

    it("accepts a valid email", () => {
      const result = preferencesSchema.parse({ email: "test@stellar.org" });
      expect(result.email).toBe("test@stellar.org");
    });

    it("rejects an invalid email", () => {
      const result = preferencesSchema.safeParse({ email: "not-an-email" });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid locale", () => {
      const result = preferencesSchema.safeParse({ locale: "xx-INVALID" });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid displayCurrency", () => {
      const result = preferencesSchema.safeParse({ displayCurrency: "DOGE" });
      expect(result.success).toBe(false);
    });

    it("strips unknown keys (strict by default for z.object)", () => {
      const result = preferencesSchema.parse({ unknownKey: "value" });
      expect(result).not.toHaveProperty("unknownKey");
    });
  });

  /* ── validatePreferences ────────────────────────────────── */
  describe("validatePreferences", () => {
    it("returns success with data for a valid empty object", () => {
      const result = validatePreferences({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.locale).toBe("en-US");
        expect(result.data.displayCurrency).toBe("USD");
        expect(result.data.notifications.sms).toBe(false);
      }
    });

    it("returns success with fully specified valid input", () => {
      const input = {
        email: "alice@stellar.org",
        locale: "ko",
        displayCurrency: "KRW",
        notifications: { email: true, push: false, sms: true, inApp: true },
      };
      const result = validatePreferences(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    it("returns failure with keyed errors for invalid locale", () => {
      const result = validatePreferences({ locale: "nope" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveProperty("locale");
        expect(typeof result.errors.locale).toBe("string");
      }
    });

    it("returns failure with keyed errors for invalid currency", () => {
      const result = validatePreferences({ displayCurrency: "INVALID" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveProperty("displayCurrency");
      }
    });

    it("returns failure with keyed errors for invalid email", () => {
      const result = validatePreferences({ email: "bad-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveProperty("email");
      }
    });

    it("returns dotted-path keys for nested notification errors", () => {
      const result = validatePreferences({
        notifications: { email: "not-a-boolean" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveProperty("notifications.email");
      }
    });

    it("returns errors for multiple invalid fields simultaneously", () => {
      const result = validatePreferences({
        locale: "xx",
        displayCurrency: "FAKE",
        email: "bad",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(2);
      }
    });

    it("keeps only the first error per path", () => {
      const result = validatePreferences({
        notifications: { email: 123, push: "wrong" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Each path should have exactly one error message
        const keys = Object.keys(result.errors);
        for (const key of keys) {
          expect(typeof result.errors[key]).toBe("string");
        }
      }
    });

    it("handles a fully invalid payload (non-object)", () => {
      const result = validatePreferences("not-an-object");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(1);
      }
    });

    it("handles null input", () => {
      const result = validatePreferences(null);
      expect(result.success).toBe(false);
    });

    it("handles undefined input", () => {
      const result = validatePreferences(undefined);
      expect(result.success).toBe(false);
    });

    it("handles numeric input", () => {
      const result = validatePreferences(42);
      expect(result.success).toBe(false);
    });

    it("defaults absent fields correctly (en-US, USD, notification defaults with sms: false)", () => {
      const result = validatePreferences({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.locale).toBe("en-US");
        expect(result.data.displayCurrency).toBe("USD");
        expect(result.data.notifications).toEqual({
          email: true,
          push: true,
          sms: false,
          inApp: true,
        });
      }
    });
  });
});
