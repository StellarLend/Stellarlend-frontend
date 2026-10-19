import dynamic from 'next/dynamic';
const ClientWalletProvider = dynamic(() => import('@/components/wallet').then(mod => mod.WalletProvider), { ssr: false });

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
      {/* Dynamically load WalletProvider only on client side */}
      <ClientWalletProvider>{children}</ClientWalletProvider>
    </body>
  </html>
);
}
