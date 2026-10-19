import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

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
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
