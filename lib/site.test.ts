import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { buildMetadata, getSiteUrl, getSitemapEntries } from "./site";

const messages = { en, es } as const;
type TestLocale = keyof typeof messages;
type TestPage = "markets" | "docs";

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

describe("buildMetadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const cases: {
    locale: TestLocale;
    page: TestPage;
    path: string;
    canonical: string;
  }[] = [
    { locale: "en", page: "markets", path: "/markets", canonical: "https://example.com/markets" },
    { locale: "en", page: "docs", path: "/docs", canonical: "https://example.com/docs" },
    { locale: "es", page: "markets", path: "/markets", canonical: "https://example.com/es/markets" },
    { locale: "es", page: "docs", path: "/docs", canonical: "https://example.com/es/docs" },
  ];

  it.each(cases)(
    "builds $locale metadata for /$page with canonical, hreflang and social tags",
    ({ locale, page, path, canonical }) => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");

      const { title, description } = messages[locale].meta[page];
      const metadata = buildMetadata({ locale, path, title, description });
      const englishUrl = `https://example.com${path}`;
      const spanishUrl = `https://example.com/es${path}`;

      expect(metadata.title).toBe(title);
      expect(metadata.description).toBe(description);
      expect(metadata.alternates).toEqual({
        canonical,
        languages: { en: englishUrl, es: spanishUrl },
      });
      expect(metadata.openGraph).toMatchObject({
        type: "website",
        siteName: "StellarLend",
        url: canonical,
        title,
        description,
        locale: locale === "es" ? "es_ES" : "en_US",
        alternateLocale: [locale === "es" ? "en_US" : "es_ES"],
      });
      expect(metadata.openGraph).toHaveProperty("images", [
        {
          url: "https://example.com/images/herogradient.png",
          width: 2880,
          height: 1042,
          alt: title,
        },
      ]);
      expect(metadata.twitter).toEqual({
        card: "summary_large_image",
        title,
        description,
        images: ["https://example.com/images/herogradient.png"],
      });
    },
  );

  it("normalizes trailing slashes and uses the root canonical for the home page", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com/");

    const metadata = buildMetadata({
      locale: "es",
      path: "/",
      title: messages.es.meta.home.title,
      description: messages.es.meta.home.description,
    });

    expect(metadata.alternates?.canonical).toBe("https://example.com/es");
    expect(metadata.alternates?.languages).toEqual({
      en: "https://example.com/",
      es: "https://example.com/es",
    });
  });

  it("rejects unsupported locales and malformed paths", () => {
    expect(() =>
      buildMetadata({ locale: "fr", path: "/markets", title: "t", description: "d" }),
    ).toThrow("Unsupported locale: fr");
    expect(() =>
      buildMetadata({ locale: "en", path: "markets", title: "t", description: "d" }),
    ).toThrow('Metadata path must start with "/"');
    expect(() =>
      buildMetadata({ locale: "en", path: "/markets?tab=1", title: "t", description: "d" }),
    ).toThrow("Metadata path must not contain a query string or hash");
  });
});
