import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import { DocsPage } from "@/components/docs-page";
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
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10"><DocsPage /></main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
