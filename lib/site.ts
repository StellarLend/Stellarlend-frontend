import type { Metadata } from "next";
import { defaultLocale, locales } from "@/i18n/routing";

const DEFAULT_SITE_URL = "https://stellarlend-frontend-tau.vercel.app";

export const SITE_NAME = "StellarLend";

// Reuse the existing hero artwork as the default social card; a dedicated
// 1200x630 OG image is tracked separately.
const DEFAULT_OG_IMAGE = {
  path: "/images/herogradient.png",
  width: 2880,
  height: 1042,
} as const;

type Locale = (typeof locales)[number];

const publicRoutes: readonly { path: string; locales: readonly Locale[] }[] = [
  { path: "/", locales },
  { path: "/markets", locales },
  { path: "/amm", locales },
  { path: "/docs", locales },
  { path: "/flash-loans", locales },
  { path: "/history", locales },
  { path: "/multisig", locales },
  { path: "/governance", locales: [defaultLocale] },
];

export function getSiteUrl(siteUrl = process.env.NEXT_PUBLIC_SITE_URL): string {
  const parsedUrl = new URL(siteUrl?.trim() || DEFAULT_SITE_URL);

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS");
  }
  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must not contain credentials, query, or hash");
  }

  return `${parsedUrl.origin}${parsedUrl.pathname.replace(/\/+$/, "")}`;
}

function getLocalizedPath(path: string, locale: Locale): string {
  if (locale === defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

function toAbsoluteUrl(path: string, siteUrl: string): string {
  return path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`;
}

export type BuildMetadataInput = {
  locale: string;
  path: string;
  title: string;
  description: string;
};

function isLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}

function normalizePath(path: string): string {
  const trimmed = path.trim();

  if (!trimmed.startsWith("/")) {
    throw new Error('Metadata path must start with "/"');
  }
  if (trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error("Metadata path must not contain a query string or hash");
  }

  return trimmed.replace(/\/+$/, "") || "/";
}

/**
 * Build per-page, per-locale metadata: canonical URL, `en`/`es` hreflang
 * alternates, Open Graph and Twitter card data. Page titles and descriptions
 * come from `messages/<locale>.json` (`meta.*` namespace).
 */
export function buildMetadata({
  locale,
  path,
  title,
  description,
}: BuildMetadataInput): Metadata {
  if (!isLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const normalizedPath = normalizePath(path);
  const siteUrl = getSiteUrl();
  const canonical = toAbsoluteUrl(getLocalizedPath(normalizedPath, locale), siteUrl);
  const languages = Object.fromEntries(
    locales.map((candidate) => [
      candidate,
      toAbsoluteUrl(getLocalizedPath(normalizedPath, candidate), siteUrl),
    ]),
  );
  const imageUrl = toAbsoluteUrl(DEFAULT_OG_IMAGE.path, siteUrl);
  const openGraphLocale = locale === "es" ? "es_ES" : "en_US";

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: canonical,
      title,
      description,
      locale: openGraphLocale,
      alternateLocale: locales
        .filter((candidate) => candidate !== locale)
        .map((candidate) => (candidate === "es" ? "es_ES" : "en_US")),
      images: [
        {
          url: imageUrl,
          width: DEFAULT_OG_IMAGE.width,
          height: DEFAULT_OG_IMAGE.height,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function getSitemapEntries(siteUrl?: string) {
  const baseUrl = getSiteUrl(siteUrl);

  return publicRoutes.flatMap(({ path, locales: routeLocales }) => {
    const languages = Object.fromEntries(
      routeLocales.map((locale) => [
        locale,
        toAbsoluteUrl(getLocalizedPath(path, locale), baseUrl),
      ]),
    );

    return routeLocales.map((locale) => ({
      url: toAbsoluteUrl(getLocalizedPath(path, locale), baseUrl),
      alternates: { languages },
    }));
  });
}
