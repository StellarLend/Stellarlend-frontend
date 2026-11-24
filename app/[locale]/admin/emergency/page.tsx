import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import { EmergencyControls } from "@/components/admin/emergency-controls";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.adminEmergency" });

  return buildMetadata({
    locale,
    path: "/admin/emergency",
    title: t("title"),
    description: t("description"),
  });
}

export default async function AdminEmergencyLocalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
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
