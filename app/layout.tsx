import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StellarLend - Lending on Stellar",
  description: "Supply and borrow assets on Stellar with StellarLend, a Soroban-powered lending protocol (testnet).",
};

// The nonce-based CSP from middleware.ts is per request, so pages must be
// rendered dynamically for Next.js to attach the nonce to its scripts.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-now-rap">
            <a href="/" className="shrink-0 truncate text-base font-semibold tracking-tight text-white">
              StellarLend
            </a>
            <nav className="order-3 flex w-full items-center gap-4 text-sm text-slate-300 sm:order-none sm:w-auto sm:flex-1">
              <a href="/markets" className="hover:text-white">Markets</a>
              <a href="/docs" className="hover:text-white">Docs</a>
            </nav>
            <div className="ml-auto min-w-0 max-w-[45% truncate text-sm text-slate-300 sm:max-w-none">
              <w3m-button />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
