import { validatePreferences } from "./preferences-validation";

describe("validatePreferences", () => {
  it("accepts a minimal valid payload", () => {
    const result = validatePreferences({ locale: "en-US", displayCurrency: "USD" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locale).toBe("en-US");
      expect(result.data.notifications.inApp).toBe(true);
    }
  });

  it("rejects invalid email", () => {
    const result = validatePreferences({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.email).toBeDefined();
    }
  });

  it("rejects unknown locale", () => {
    const result = validatePreferences({ locale: "xx-XX" });
    expect(result.success).toBe(false);
  });
});
