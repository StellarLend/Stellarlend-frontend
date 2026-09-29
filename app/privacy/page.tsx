import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy | Stellarlend',
  description: 'Learn how Stellarlend collects, uses, and protects your information.',
};

export default function PrivacyPage() {
  return (
    <StubPageLayout
      title="Privacy Policy"
      description="Last updated: July 2026"
    >
      <div className="prose prose-invert max-w-none space-y-8 text-[#AAABAB]">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">1. Information We Collect</h2>
          <p>
            Stellarlend collects information you provide directly (e.g., email for newsletter
            subscription) and information collected automatically when you interact with the
            Protocol (e.g., wallet addresses used in on-chain transactions, browser type, IP
            address for rate-limiting purposes).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
          <p>
            We use collected information to operate and improve the Protocol, send you updates
            you&apos;ve opted in to, comply with legal obligations, and prevent fraud or abuse.
          </p>
          <p className="mt-2">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">3. Blockchain Data</h2>
          <p>
            Transactions executed on the Stellar blockchain are publicly visible and immutable.
            Stellarlend does not control this public ledger data.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">4. Cookies and Tracking</h2>
          <p>
            We use essential cookies required for site operation. For a full breakdown, see our{' '}
            <a href="/cookies" className="text-[#15A350] hover:underline">
              Cookie Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">5. Your Rights</h2>
          <p>
            Depending on your location, you may have rights regarding your personal data including
            the right to access, correct, or delete it. Contact us to exercise these rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">6. Contact</h2>
          <p>
            Privacy inquiries:{' '}
            <a
              href="mailto:privacy@stellarlend.com"
              className="text-[#15A350] hover:underline"
            >
              privacy@stellarlend.com
            </a>
          </p>
        </section>

        <p className="text-sm italic">
          This page contains placeholder content while our full Privacy Policy is being drafted.
          Check back soon for the complete document.
        </p>
      </div>
    </StubPageLayout>
  );
}
