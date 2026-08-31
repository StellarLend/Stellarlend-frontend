import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Contact | Stellarlend',
  description: 'Get in touch with the Stellarlend team.',
};

const contacts = [
  {
    label: 'General enquiries',
    email: 'hello@stellarlend.com',
    description: 'Questions about the protocol, integrations, or partnerships.',
  },
  {
    label: 'Security',
    email: 'security@stellarlend.com',
    description: 'Responsible disclosure of vulnerabilities. We respond within 48 hours.',
  },
  {
    label: 'Legal & Privacy',
    email: 'legal@stellarlend.com',
    description: 'GDPR requests, privacy inquiries, and legal correspondence.',
  },
  {
    label: 'Press',
    email: 'press@stellarlend.com',
    description: 'Media enquiries and press kit requests.',
  },
];

export default function ContactPage() {
  return (
    <StubPageLayout
      title="Contact Us"
      description="We would love to hear from you."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[#AAABAB]">
          {contacts.map((c) => (
            <div
              key={c.label}
              className="border border-[#1D2025] rounded-xl p-6 hover:border-[#15A350] transition-colors"
            >
              <h2 className="text-lg font-semibold text-white mb-1">{c.label}</h2>
              <a
                href={`mailto:${c.email}`}
                className="text-[#15A350] hover:underline text-sm block mb-3"
              >
                {c.email}
              </a>
              <p className="text-sm">{c.description}</p>
            </div>
          ))}
        </div>

        <div className="border border-[#1D2025] rounded-xl p-6 text-[#AAABAB]">
          <h2 className="text-lg font-semibold text-white mb-2">Community</h2>
          <p className="text-sm mb-4">
            For real-time support and discussions, join us on our social channels:
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="https://twitter.com/stellarlend" className="text-[#15A350] hover:underline text-sm" target="_blank" rel="noopener noreferrer">
              Twitter / X
            </a>
            <a href="https://github.com/stellarlend" className="text-[#15A350] hover:underline text-sm" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://linkedin.com/company/stellarlend" className="text-[#15A350] hover:underline text-sm" target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </StubPageLayout>
  );
}
