import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DocsPage } from "@/components/docs-page";
import { getDocsData } from "@/lib/docs-data";
import { buildMetadata } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.docs" });

  return buildMetadata({
    locale,
    path: "/docs",
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
  const docsData = await getDocsData();
  return <DocsPage data={docsData} />;
}
