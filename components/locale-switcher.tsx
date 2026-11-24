"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";

export function localizedHref(
  pathname: string,
  search: string,
  hash: string,
  nextLocale: "en" | "es",
): string {
  const target = pathname.replace(/^\/es(?=\/|$)/, "") || "/";
  const base = nextLocale === "en" ? target : target === "/" ? "/es" : `/es${target}`;
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const fragment = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return `${base}${query}${fragment}`;
}

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const t = useTranslations("nav");
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname, searchParams]);

  const nextLocale = locale === "en" ? "es" : "en";
  const href = localizedHref(pathname, searchParams?.toString() ?? "", hash, nextLocale);

  return (
    <Link href={href} className="btn-ghost whitespace-nowrap px-3 py-1 text-xs sm:text-sm">
      {t("switchLocale")}
    </Link>
  );
}
