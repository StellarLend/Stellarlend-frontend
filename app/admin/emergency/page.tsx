import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import { EmergencyControls } from "@/components/admin/emergency-controls";
import { defaultLocale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: defaultLocale, namespace: "meta.adminEmergency" });

  return buildMetadata({
    locale: defaultLocale,
    path: "/admin/emergency",
    title: t("title"),
    description: t("description"),
  });
}

export default async function AdminEmergencyPage() {
  const messages = await getMessages({ locale: "en" });

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <EmergencyControls />
        </main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
