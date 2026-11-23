import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/lib/config";
import { QueryProvider } from "@/components/query-provider";
import manifest from "./manifest";

export const metadata: Metadata = {
  title: "StellarLend - Lending on Stellar",
  description: "Supply and borrow assets on Stellar with StellarLend, a Soroban-powered lending protocol (testnet).",
};

export const viewport: Viewport = {
  themeColor: manifest().theme_color,
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
