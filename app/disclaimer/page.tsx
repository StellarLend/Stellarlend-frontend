import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Disclaimer | Stellarlend',
  description: 'Important disclaimers regarding the Stellarlend Protocol.',
};

export default function DisclaimerPage() {
  return (
    <StubPageLayout
      title="Disclaimer"
      description="Please read this disclaimer carefully before using the Stellarlend Protocol."
    >
      <div className="prose prose-invert max-w-none space-y-8 text-[#AAABAB]">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Not Financial Advice</h2>
          <p>
            Nothing on this website or within the Stellarlend Protocol constitutes financial,
            investment, legal, or tax advice. All content is provided for informational purposes
            only. You should consult qualified professionals before making any financial decisions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Risk of Loss</h2>
          <p>
            Digital assets are highly volatile. Using DeFi protocols involves significant risk of
            loss, including the total loss of funds. Past performance does not guarantee future
            results. You should only participate with funds you can afford to lose entirely.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Smart Contract Risk</h2>
          <p>
            While the Stellarlend smart contracts have been audited, no audit eliminates all risk.
            Vulnerabilities may exist that could result in loss of funds. Use the Protocol at your
            own risk.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Regulatory Risk</h2>
          <p>
            DeFi protocols operate in an evolving regulatory environment. Changes in law or
            regulation may adversely affect the availability, operation, or legality of the
            Protocol in your jurisdiction. It is your responsibility to ensure compliance with all
            applicable laws.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">No Warranty</h2>
          <p>
            Stellarlend is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
            warranty of any kind. We do not warrant that the Protocol will be uninterrupted,
            error-free, or free of harmful components.
          </p>
        </section>

        <p className="text-sm italic">
          This page contains placeholder content while our full Disclaimer is being finalized.
        </p>
      </div>
    </StubPageLayout>
  );
}
