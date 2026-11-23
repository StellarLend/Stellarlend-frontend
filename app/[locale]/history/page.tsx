import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import History from "@/components/history";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.history" });

  return buildMetadata({
    locale,
    path: "/history",
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
  return <History />;
}
