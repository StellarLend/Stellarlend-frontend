import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import FlashLoans from "@/components/flash-loans";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.flashLoans" });

  return buildMetadata({
    locale,
    path: "/flash-loans",
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
  return <FlashLoans />;
}
