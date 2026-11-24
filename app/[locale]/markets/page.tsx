import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import MarketsApp from "@/components/markets-app";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.markets" });

  return buildMetadata({
    locale,
    path: "/markets",
    title: t("title"),
    description: t("description"),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <MarketsApp />
    </Suspense>
  );
}
