import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";

/** Shared locale + wallet shell (header, main, footer) used by app pages. */
export async function PageShell({ locale = "en", children }: { locale?: string; children: React.ReactNode }) {
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
