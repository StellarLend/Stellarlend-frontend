import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service | Stellarlend',
  description: 'Read the Stellarlend Terms of Service.',
};

export default function TermsPage() {
  return (
    <StubPageLayout
      title="Terms of Service"
      description="Last updated: July 2026"
    >
      <div className="prose prose-invert max-w-none space-y-8 text-[#AAABAB]">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Stellarlend (&ldquo;the Protocol&rdquo;), you agree to be bound by
            these Terms of Service and all applicable laws and regulations. If you do not agree
            with any of these terms, you are prohibited from using the Protocol.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">2. Description of Service</h2>
          <p>
            Stellarlend is a non-custodial decentralized finance (DeFi) lending protocol built on
            the Stellar blockchain. The Protocol enables users to lend and borrow digital assets
            through smart contracts. Stellarlend does not hold, control, or custody any user funds.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">3. Risks</h2>
          <p>
            DeFi protocols carry significant risks including, but not limited to: smart contract
            vulnerabilities, market volatility, liquidation risk, and regulatory uncertainty. You
            acknowledge and accept all risks associated with using the Protocol.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">4. Prohibited Uses</h2>
          <p>
            You may not use the Protocol for any unlawful purpose or in violation of any
            applicable laws or regulations, including sanctions laws.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">5. Disclaimer of Warranties</h2>
          <p>
            The Protocol is provided &ldquo;as is&rdquo; without warranty of any kind. Stellarlend
            expressly disclaims all warranties, express or implied.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">6. Contact</h2>
          <p>
            For questions about these Terms, contact us at{' '}
            <a
              href="mailto:legal@stellarlend.com"
              className="text-[#15A350] hover:underline"
            >
              legal@stellarlend.com
            </a>
            .
          </p>
        </section>

        <p className="text-sm italic">
          This page contains placeholder content while our full Terms of Service are being drafted
          by legal counsel. Check back soon for the complete document.
        </p>
      </div>
    </StubPageLayout>
  );
}
