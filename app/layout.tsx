import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StellarLend - Lending on Stellar",
  description: "Supply and borrow assets on Stellar with StellarLend, a Soroban-powered lending protocol (testnet).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
