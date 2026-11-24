"use client";

import React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ConnectButton } from "@/components/wallet";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ProtocolStatusBanner } from "@/components/protocol-status";
import { NetworkBanner } from "@/components/network-banner";

export function Header() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const marketsHref = locale === "es" ? "/es/markets" : "/markets";
  const historyHref = locale === "es" ? "/es/history" : "/history";
  const flashLoansHref = locale === "es" ? "/es/flash-loans" : "/flash-loans";
  const ammHref = locale === "es" ? "/es/amm" : "/amm";
  const governanceHref = locale === "es" ? "/es/governance" : "/governance";
  const liquidateHref = locale === "es" ? "/es/liquidate" : "/liquidate";
  const docsHref = locale === "es" ? "/es/docs" : "/docs";
  const homeHref = locale === "es" ? "/es" : "/";

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--bg)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--fg)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--acc)]"
      >
        {t("skipToContent")}
      </a>
      <NetworkBanner />
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur">

      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 sm:flex-nowrap sm:justify-between sm:gap-4">
        <Link href={homeHref} className="shrink-0 text-lg font-bold">
          <span className="grad">{t("brand")}</span>Lend
        </Link>
        <nav
          aria-label="Main navigation"
          className="order-3 flex w-full min-w-0 items-center gap-4 overflow-x-auto whitespace-nowrap pb-1 text-xs mut sm:order-none sm:w-auto sm:flex-1 sm:justify-center sm:gap-5 sm:overflow-visible sm:pb-0 sm:text-sm"
        >
          <Link href={marketsHref} className="hover:text-white">{t("markets")}</Link>
          <Link href={historyHref} className="hover:text-white">{t("history")}</Link>
          <Link href={flashLoansHref} className="hover:text-white">{t("flashLoans")}</Link>
          <Link href={liquidateHref} className="hover:text-white">{t("liquidate")}</Link>
          <Link href={ammHref} className="hover:text-white">{t("amm")}</Link>
          <Link href={governanceHref} className="hover:text-white">{t("governance")}</Link>
          <Link href={docsHref} className="hover:text-white">{t("docs")}</Link>
          <a href="https://github.com/StellarLend/Stellarlend-frontend" className="hidden hover:text-white sm:inline">
            {t("github")}
          </a>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <ConnectButton />
        </div>
      </div>
      <ProtocolStatusBanner />
    </header>
    </>
  );
}
