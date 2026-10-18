import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { WalletProvider, ConnectButton } from "@/components/wallet";

export const metadata: Metadata = {
  title: "StellarLend - Lending on Stellar",
  description: "Supply and borrow assets on Stellar with StellarLend, a Soroban-powered lending protocol (testnet).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <WalletProvider>
          <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="text-lg font-bold"><span className="grad">Stellar</span>Lend</Link>
              <nav className="flex items-center gap-5 text-sm mut">
                <Link href="/markets" className="hover:text-white">Markets</Link>
                <Link href="/docs" className="hover:text-white">Docs</Link>
                <a href="https://github.com/StellarLend" className="hidden hover:text-white sm:inline">GitHub</a>
              </nav>
              <ConnectButton />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-10 text-sm mut">
            StellarLend runs on Stellar testnet. No real funds. Not financial advice.
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
