"use client";

import React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ConnectButton } from "@/components/wallet";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function Header() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const marketsHref = locale === "es" ? "/es/markets" : "/markets";
  const flashLoansHref = locale === "es" ? "/es/flash-loans" : "/flash-loans";
  const ammHref = locale === "es" ? "/es/amm" : "/amm";
  const governanceHref = locale === "es" ? "/es/multisig" : "/multisig";
  const docsHref = locale === "es" ? "/es/docs" : "/docs";
  const homeHref = locale === "es" ? "/es" : "/";

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={homeHref} className="text-lg font-bold">
          <span className="grad">{t("brand")}</span>Lend
        </Link>
        <nav className="flex items-center gap-2 text-xs mut sm:gap-5 sm:text-sm">
          <Link href={marketsHref} className="hover:text-white">{t("markets")}</Link>
          <Link href={flashLoansHref} className="hover:text-white">{t("flashLoans")}</Link>
          <Link href={ammHref} className="hover:text-white">{t("amm")}</Link>
          <Link href={governanceHref} className="hover:text-white">{t("governance")}</Link>
          <Link href={docsHref} className="hover:text-white">{t("docs")}</Link>
          <a href="https://github.com/StellarLend/Stellarlend-frontend" className="hidden hover:text-white sm:inline">
            {t("github")}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
