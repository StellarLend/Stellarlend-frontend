import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Audits | Stellarlend',
  description: 'Security audit reports for the Stellarlend smart contracts.',
};

export default function AuditsPage() {
  return (
    <StubPageLayout
      title="Security Audits"
      description="Independent reviews of the Stellarlend smart contracts."
    >
      <div className="space-y-6 text-[#AAABAB]">
        <p>
          Before every mainnet deployment, Stellarlend smart contracts are reviewed by
          independent security firms. Audit reports are published here in full so the
          community can verify the findings and their remediation status.
        </p>

        <div className="border border-dashed border-[#1D2025] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4" aria-hidden="true">🔍</div>
          <h2 className="text-xl font-semibold text-white mb-2">Audit reports coming soon</h2>
          <p className="max-w-md mx-auto">
            The protocol is currently in pre-mainnet review. Audit reports will be published
            here once completed. In the meantime, review the smart contract source code on
            GitHub.
          </p>
          <a
            href="https://github.com/stellarlend"
            className="inline-block mt-6 px-6 py-3 bg-[#15A350] hover:bg-[#128F42] text-white font-semibold rounded-lg transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source on GitHub
          </a>
        </div>

        <p className="text-sm">
          Found a vulnerability? See our{' '}
          <a href="/security" className="text-[#15A350] hover:underline">
            security page
          </a>{' '}
          for responsible disclosure guidelines.
        </p>
      </div>
    </StubPageLayout>
  );
}
