import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Careers | Stellarlend',
  description: 'Join the Stellarlend team and help build the future of DeFi on Stellar.',
};

export default function CareersPage() {
  return (
    <StubPageLayout
      title="Careers"
      description="Help us build the future of DeFi lending on Stellar."
    >
      <div className="space-y-6 text-[#AAABAB]">
        <p>
          Stellarlend is a small, focused team. We move fast, ship often, and care deeply about
          what we build. If that sounds like you, we would love to hear from you.
        </p>

        <div className="border border-dashed border-[#1D2025] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4" aria-hidden="true">🚀</div>
          <h2 className="text-xl font-semibold text-white mb-2">No open roles right now</h2>
          <p className="max-w-md mx-auto">
            We are always interested in hearing from talented engineers, designers, and
            researchers who are passionate about DeFi and Stellar.
          </p>
          <a
            href="mailto:careers@stellarlend.com"
            className="inline-block mt-6 px-6 py-3 bg-[#15A350] hover:bg-[#128F42] text-white font-semibold rounded-lg transition-colors"
          >
            Send us your CV
          </a>
        </div>
      </div>
    </StubPageLayout>
  );
}
