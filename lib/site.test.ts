import { describe, expect, it } from "vitest";
import { getSiteUrl, getSitemapEntries } from "./site";

describe("site metadata URLs", () => {
  it("uses the demo URL by default and normalizes trailing slashes", () => {
    expect(getSiteUrl("https://example.com///")).toBe("https://example.com");
    expect(getSiteUrl()).toBe("https://stellarlend-frontend-tau.vercel.app");
  });

  it("includes English and Spanish market URLs with hreflang alternates", () => {
    const entries = getSitemapEntries("https://example.com/");
    const englishMarkets = entries.find((entry) => entry.url === "https://example.com/markets");
    const spanishMarkets = entries.find(
      (entry) => entry.url === "https://example.com/es/markets",
    );

    expect(englishMarkets?.alternates.languages).toEqual({
      en: "https://example.com/markets",
      es: "https://example.com/es/markets",
    });
    expect(spanishMarkets?.alternates.languages).toEqual({
      en: "https://example.com/markets",
      es: "https://example.com/es/markets",
    });
  });

  it("excludes admin and API routes", () => {
    const urls = getSitemapEntries().map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/admin/"))).toBe(false);
    expect(urls.some((url) => url.includes("/api/"))).toBe(false);
  });

  it("rejects non-HTTP site URLs", () => {
    expect(() => getSiteUrl("ftp://example.com")).toThrow(
      "NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS",
    );
  });
});
