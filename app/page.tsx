import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import { HomePage } from "@/components/home-page";

export default async function Page() {
  const messages = await getMessages({ locale: "en" });

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10"><HomePage /></main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
