import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Features | Stellarlend',
  description: 'Explore the features of the Stellarlend DeFi lending protocol.',
};

const features = [
  {
    title: 'Non-Custodial Lending',
    description: 'Lend and borrow directly from your wallet — Stellarlend never holds your funds.',
  },
  {
    title: 'Ultra-Low Fees',
    description: 'Powered by Stellar, transactions settle in seconds with fees fractions of a cent.',
  },
  {
    title: 'Multi-Asset Support',
    description: 'Support for XLM, USDC, BTC, ETH, and other Stellar-based assets.',
  },
  {
    title: 'Real-Time Rates',
    description: 'Interest rates adjust dynamically based on supply and demand via on-chain logic.',
  },
  {
    title: 'Smart Collateral Management',
    description: 'Automated health-factor monitoring with transparent liquidation thresholds.',
  },
  {
    title: 'Audited Smart Contracts',
    description: 'Soroban contracts reviewed by independent security firms before mainnet deployment.',
  },
];

export default function FeaturesPage() {
  return (
    <StubPageLayout
      title="Features"
      description="Everything you need to lend and borrow on Stellar."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="border border-[#1D2025] rounded-xl p-6 hover:border-[#15A350] transition-colors"
          >
            <h2 className="text-lg font-semibold text-white mb-2">{f.title}</h2>
            <p className="text-[#AAABAB] text-sm">{f.description}</p>
          </div>
        ))}
      </div>

      <p className="text-sm italic text-[#AAABAB] mt-12">
        Full feature documentation is coming soon. In the meantime, explore the app or read our{' '}
        <a href="/docs" className="text-[#15A350] hover:underline">documentation</a>.
      </p>
    </StubPageLayout>
  );
}
