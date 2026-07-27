import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Security | Stellarlend',
  description: 'How Stellarlend keeps your funds and data safe.',
};

const pillars = [
  {
    title: 'Non-Custodial Architecture',
    body: 'Stellarlend never holds user funds. All value moves through audited Soroban smart contracts authorized directly from your wallet.',
  },
  {
    title: 'Smart Contract Audits',
    body: 'Protocol contracts have been reviewed by independent security firms. Reports are published publicly on the Audits page.',
  },
  {
    title: 'Responsible Disclosure',
    body: 'We operate a bug bounty programme. Report vulnerabilities to security@stellarlend.com before public disclosure.',
  },
  {
    title: 'No Admin Keys',
    body: 'Core protocol parameters are governed on-chain. There is no privileged admin key that could unilaterally drain the protocol.',
  },
  {
    title: 'Rate Limiting & CSRF Protection',
    body: 'All API routes are protected by per-account rate limiting, CSRF tokens, and strict referrer policies.',
  },
  {
    title: 'Dependency Management',
    body: 'Dependencies are pinned and reviewed on every update. Automated vulnerability scans run in CI on every pull request.',
  },
];

export default function SecurityPage() {
  return (
    <StubPageLayout
      title="Security"
      description="Security is a first-class concern at Stellarlend."
    >
      <div className="space-y-6 text-[#AAABAB]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="border border-[#1D2025] rounded-xl p-6 hover:border-[#15A350] transition-colors"
            >
              <h2 className="text-lg font-semibold text-white mb-2">{p.title}</h2>
              <p className="text-sm">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="border border-[#15A350]/30 bg-[#15A350]/10 rounded-xl p-6 mt-4">
          <h2 className="text-lg font-semibold text-white mb-2">Report a Vulnerability</h2>
          <p className="text-sm">
            Found a security issue? Email{' '}
            <a href="mailto:security@stellarlend.com" className="text-[#15A350] hover:underline">
              security@stellarlend.com
            </a>
            . We respond within 48 hours and remediate critical issues within 7 days.
          </p>
        </div>

        <p className="text-sm italic">
          Audit reports are available on the{' '}
          <a href="/audits" className="text-[#15A350] hover:underline">Audits</a> page.
        </p>
      </div>
    </StubPageLayout>
  );
}
