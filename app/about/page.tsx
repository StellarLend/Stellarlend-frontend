import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'About Us | Stellarlend',
  description: 'Learn about the team building Stellarlend.',
};

export default function AboutPage() {
  return (
    <StubPageLayout
      title="About Stellarlend"
      description="Building the future of DeFi lending on the Stellar network."
    >
      <div className="space-y-8 text-[#AAABAB]">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Our Mission</h2>
          <p>
            Stellarlend was founded on the belief that financial services should be accessible
            to everyone, regardless of geography or wealth. By building on the Stellar network
            we aim to bring permissionless lending and borrowing to people who currently lack
            access to fair credit markets.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Why Stellar?</h2>
          <p>
            Stellar was designed for financial applications. With 3-5 second finality, fees
            measured in fractions of a cent, and native multi-asset support, it is the ideal
            platform for a lending protocol that serves real users.
          </p>
          <p className="mt-3">
            Soroban gives us the programmability of Ethereum with the efficiency and reliability
            of the Stellar core protocol.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Open Source</h2>
          <p>
            All Stellarlend smart contracts and this frontend are open source. Transparency is
            a prerequisite for trust in financial protocols.
          </p>
          <a
            href="https://github.com/stellarlend"
            className="inline-block mt-3 text-[#15A350] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub &rarr;
          </a>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Get in Touch</h2>
          <p>
            Interested in contributing, partnering, or just saying hello?{' '}
            <a href="/contact" className="text-[#15A350] hover:underline">Contact us</a>
            {' '}or{' '}
            <a href="/careers" className="text-[#15A350] hover:underline">join the team</a>.
          </p>
        </section>

        <p className="text-sm italic">Full team bios and company history coming soon.</p>
      </div>
    </StubPageLayout>
  );
}
