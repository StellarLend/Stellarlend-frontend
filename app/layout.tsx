import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { WalletProvider } from "@/context/WalletContext";
import NextTopLoader from "nextjs-toploader";
import { headers } from "next/headers";
import { ToastProvider } from "@/components/shared/common/Toast";
import NotificationToastBridge from "@/components/shared/common/NotificationToastBridge";
import SessionExpiryModal from "@/components/shared/common/SessionExpiryModal";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StellarLend",
  description: "Decentralized lending and borrowing on Stellar",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Retrieve CSP nonce from middleware header
  const nonce = (await headers()).get("x-csp-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={`${inter.variable} antialiased`}>
        {/* Top progress bar */}
        <NextTopLoader
          color="#15a350"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #15a350, 0 0 5px #15a350"
          zIndex={9999}
        />
        {/* Example inline script that uses the CSP nonce */}
        {nonce && (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `window.CSP_NONCE = "${nonce}";`,
            }}
          />
        )}
        <ToastProvider>
          <NotificationToastBridge />
          <WalletProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </WalletProvider>
          {/* Single app-wide instance — drives proactive session-expiry UX. */}
          <SessionExpiryModal />
        </ToastProvider>
      </body>
    </html>
  );
}
