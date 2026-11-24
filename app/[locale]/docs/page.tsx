import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import { DocsPage } from "@/components/docs-page";
import { getDocsData } from "@/lib/docs-data";

export const revalidate = 300;
import { buildMetadata } from "@/lib/site";

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

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [messages, docsData] = await Promise.all([
    getMessages({ locale }),
    getDocsData(),
  ]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10"><DocsPage data={docsData} /></main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
