import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MultisigApp } from "@/components/multisig/multisig-app";
import { PageShell } from "@/components/page-shell";
import { defaultLocale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: defaultLocale, namespace: "meta.multisig" });

  return buildMetadata({
    locale: defaultLocale,
    path: "/multisig",
    title: t("title"),
    description: t("description"),
  });
}

export default function Page() {
  return (
    <PageShell>
      <MultisigApp />
    </PageShell>
  );
}
