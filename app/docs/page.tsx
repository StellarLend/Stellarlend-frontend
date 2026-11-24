import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import { DocsPage } from "@/components/docs-page";
import { getDocsData } from "@/lib/docs-data";
import { defaultLocale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/site";

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: defaultLocale, namespace: "meta.docs" });

  return buildMetadata({
    locale: defaultLocale,
    path: "/docs",
    title: t("title"),
    description: t("description"),
  });
}

export default async function Page() {
  const [messages, docsData] = await Promise.all([
    getMessages({ locale: "en" }),
    getDocsData(),
  ]);

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10"><DocsPage data={docsData} /></main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
