import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Pricing | Stellarlend',
  description: 'Stellarlend has no platform fees. Earn and borrow with transparent on-chain rates.',
};

const cards = [
  {
    title: 'Lending Rates',
    body: 'Earn interest dynamically set by on-chain supply and demand. Rates update in real-time and are always visible in the app dashboard.',
  },
  {
    title: 'Borrowing Rates',
    body: 'Variable APR based on utilization of each asset pool. Over-collateralize to reduce liquidation risk.',
  },
  {
    title: 'Network Fees',
    body: 'All transactions are submitted to the Stellar network. The base fee is currently 100 stroops (0.00001 XLM) per operation.',
  },
  {
    title: 'Liquidation Penalty',
    body: 'If a position falls below its health factor, a liquidation bonus is paid to the liquidator. Parameters are defined in the smart contract.',
  },
];

export default function PricingPage() {
  return (
    <StubPageLayout
      title="Pricing"
      description="Transparent, on-chain rates — no hidden platform fees."
    >
      <div className="space-y-8 text-[#AAABAB]">
        <div className="border border-[#1D2025] rounded-xl p-8 text-center">
          <div className="text-5xl font-bold text-white mb-2">$0</div>
          <div className="text-lg text-[#15A350] font-semibold mb-4">Platform Fee</div>
          <p>
            Stellarlend charges no platform fee. You pay only the Stellar network transaction
            fee and any interest accrued from borrowing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {cards.map((c) => (
            <div key={c.title} className="border border-[#1D2025] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">{c.title}</h2>
              <p className="text-sm">{c.body}</p>
            </div>
          ))}
        </div>

        <p className="text-sm italic">
          Live rates are displayed in the{' '}
          <a href="/dashboard" className="text-[#15A350] hover:underline">app dashboard</a>.
        </p>
      </div>
    </StubPageLayout>
  );
}
