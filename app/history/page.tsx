import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import History from "@/components/history";
import { defaultLocale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: defaultLocale, namespace: "meta.history" });

  return buildMetadata({
    locale: defaultLocale,
    path: "/history",
    title: t("title"),
    description: t("description"),
  });
}

export default async function Page() {
  const messages = await getMessages({ locale: "en" });

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10"><History /></main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
