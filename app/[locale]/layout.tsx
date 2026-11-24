import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { locales } from "@/i18n/routing";
import { QueryProvider } from "@/components/query-provider";
import { WalletProvider } from "@/components/wallet";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ErrorReporterInit } from "@/components/error-reporter-init";
import manifest from "../manifest";
import "../globals.css";
import "@/lib/config";

export const metadata: Metadata = {
  title: "StellarLend - Lending on Stellar",
  description: "Supply and borrow assets on Stellar with StellarLend, a Soroban-powered lending protocol (testnet).",
};

export const viewport: Viewport = {
  themeColor: manifest().theme_color,
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <QueryProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <WalletProvider>
              <ErrorReporterInit />
              <Header />
              <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
                {children}
              </main>
              <Footer />
            </WalletProvider>
          </NextIntlClientProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
