"use client";

import React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const t = useTranslations("nav");
  const nextLocale = locale === "en" ? "es" : "en";
  const target = pathname.startsWith("/es") ? pathname.replace(/^\/es/, "") || "/" : pathname;
  const href = nextLocale === "en" ? target : `/es${target === "/" ? "" : target}`;

  return (
    <Link href={href} className="btn-ghost whitespace-nowrap px-3 py-1 text-xs sm:text-sm">
      {t("switchLocale")}
    </Link>
  );
}
