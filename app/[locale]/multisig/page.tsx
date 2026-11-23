import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MultisigApp } from "@/components/multisig/multisig-app";
import { PageShell } from "@/components/page-shell";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.multisig" });

  return buildMetadata({
    locale,
    path: "/multisig",
    title: t("title"),
    description: t("description"),
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <PageShell locale={locale}>
      <MultisigApp />
    </PageShell>
  );
}
