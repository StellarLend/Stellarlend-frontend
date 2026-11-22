import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import { GovernanceView } from "@/components/governance-view";
import { config } from "@/lib/config";
import { AUDIT_PAGE_SIZE, createContractReader, getGovernanceSnapshot } from "@/lib/governance";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "governance" });
  return { title: t("metaTitle") };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ audit?: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages({ locale });
  const requested = Number((await searchParams)?.audit);
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 200) : AUDIT_PAGE_SIZE;
  const snapshot = config.lendingId
    ? await getGovernanceSnapshot(createContractReader(config.lendingId), limit)
    : null;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <GovernanceView snapshot={snapshot} auditLimit={limit} contractId={config.lendingId} />
        </main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
