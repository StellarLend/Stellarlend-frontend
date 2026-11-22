import { defaultLocale, locales } from "@/i18n/routing";

const DEFAULT_SITE_URL = "https://stellarlend-frontend-tau.vercel.app";

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
