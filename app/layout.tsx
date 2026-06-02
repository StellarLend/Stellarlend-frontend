import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/context/SidebarContext";
import NextTopLoader from "nextjs-toploader";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StellarLend",
  description: "Decentralized lending and borrowing on Stellar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={`${inter.variable} antialiased`}>
        {/*
          Top progress bar for route transitions.
          - color matches --color-primary (#15a350)
          - showSpinner disabled to avoid duplicate loading indicators
          - shadow uses the same green with opacity
          - crawlSpeed / speed tuned so fast navigations don't flicker
        */}
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
        <SidebarProvider>{children}</SidebarProvider>
      </body>
    </html>
  );
}
