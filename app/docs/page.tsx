import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Documentation | Stellarlend',
  description: 'Guides, references, and tutorials for the Stellarlend protocol.',
};

const sections = [
  {
    title: 'Getting Started',
    links: [
      { label: 'What is Stellarlend?', href: '#' },
      { label: 'Connect your wallet', href: '#' },
      { label: 'Lending your first asset', href: '#' },
      { label: 'Borrowing against collateral', href: '#' },
    ],
  },
  {
    title: 'Protocol Mechanics',
    links: [
      { label: 'Interest rate model', href: '#' },
      { label: 'Collateral factors', href: '#' },
      { label: 'Liquidations explained', href: '#' },
      { label: 'Health factor', href: '#' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Smart contract overview', href: '#' },
      { label: 'API reference', href: '/api-docs' },
      { label: 'Testnet deployment', href: '#' },
    ],
  },
  {
    title: 'Security & Audits',
    links: [
      { label: 'Security overview', href: '/security' },
      { label: 'Audit reports', href: '/audits' },
    ],
  },
];

export default function DocsPage() {
  return (
    <StubPageLayout
      title="Documentation"
      description="Everything you need to understand and build with Stellarlend."
    >
      <div className="space-y-8">
        <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-xl p-4 text-yellow-300 text-sm">
          Full documentation is under construction. Links marked # are placeholders.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {sections.map((section) => (
            <div key={section.title} className="border border-[#1D2025] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-3">{section.title}</h2>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-[#15A350] hover:underline text-sm">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </StubPageLayout>
  );
}
