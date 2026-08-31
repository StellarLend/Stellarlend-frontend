import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'FAQ | Stellarlend',
  description: 'Frequently asked questions about the Stellarlend protocol.',
};

const faqs = [
  {
    q: 'What is Stellarlend?',
    a: 'Stellarlend is a non-custodial DeFi lending protocol built on the Stellar blockchain. It lets you earn interest by supplying assets or borrow against collateral, all without handing custody of your funds to a third party.',
  },
  {
    q: 'How do I get started?',
    a: 'Install the Freighter wallet browser extension, fund it with XLM or USDC on Stellar, then visit the app and connect your wallet. You can start supplying or borrowing in minutes.',
  },
  {
    q: 'Is Stellarlend safe?',
    a: 'The smart contracts have been audited by independent security firms (reports on the Audits page). However, all DeFi protocols carry risk — smart contract bugs, market volatility, and liquidation risk. Never supply more than you can afford to lose.',
  },
  {
    q: 'What happens if my position is liquidated?',
    a: 'If the value of your collateral falls below the required health factor, a liquidator can repay part of your debt and claim a portion of your collateral at a discount. You keep any remaining collateral after the liquidation.',
  },
  {
    q: 'Does Stellarlend charge platform fees?',
    a: 'No. Stellarlend charges no platform fee. You pay only the Stellar network transaction fee (fractions of a cent) and interest on any borrowed positions.',
  },
  {
    q: 'Which wallets are supported?',
    a: 'Freighter is the primary supported wallet. Support for additional Stellar-compatible wallets is planned.',
  },
  {
    q: 'Where can I get help?',
    a: 'Check the documentation first, then reach out via the Contact page or join the community on Twitter or GitHub.',
  },
];

export default function FaqPage() {
  return (
    <StubPageLayout
      title="Frequently Asked Questions"
      description="Answers to the most common questions about Stellarlend."
    >
      <div className="space-y-4">
        {faqs.map((item) => (
          <details
            key={item.q}
            className="border border-[#1D2025] rounded-xl p-6 group open:border-[#15A350] transition-colors"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between">
              <span className="font-semibold text-white">{item.q}</span>
              <span className="text-[#15A350] ml-4 shrink-0 group-open:rotate-45 transition-transform text-xl leading-none">
                +
              </span>
            </summary>
            <p className="mt-4 text-[#AAABAB] text-sm leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-8 text-sm text-[#AAABAB] italic">
        More questions? Visit the{' '}
        <a href="/docs" className="text-[#15A350] hover:underline">documentation</a> or{' '}
        <a href="/contact" className="text-[#15A350] hover:underline">contact us</a>.
      </p>
    </StubPageLayout>
  );
}
