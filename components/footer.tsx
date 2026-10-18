"use client";

import React from "react";
import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="mx-auto max-w-6xl px-4 py-10 text-sm mut">
      <p>{t("notice")}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <a href="https://github.com/StellarLend/Stellarlend-frontend" className="hover:text-white">{t("github")}</a>
        <a href="https://stellarlend-frontend-tau.vercel.app" className="hover:text-white">{t("liveSite")}</a>
      </p>
    </footer>
  );
}
