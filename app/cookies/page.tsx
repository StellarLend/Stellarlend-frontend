import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Cookie Policy | Stellarlend',
  description: 'How Stellarlend uses cookies and similar technologies.',
};

export default function CookiesPage() {
  return (
    <StubPageLayout
      title="Cookie Policy"
      description="Last updated: July 2026"
    >
      <div className="prose prose-invert max-w-none space-y-8 text-[#AAABAB]">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">What Are Cookies?</h2>
          <p>
            Cookies are small text files placed on your device when you visit a website. They help
            the site remember your preferences and improve your experience.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Cookies We Use</h2>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1D2025]">
                  <th className="text-left text-white py-2 pr-4">Name</th>
                  <th className="text-left text-white py-2 pr-4">Type</th>
                  <th className="text-left text-white py-2 pr-4">Purpose</th>
                  <th className="text-left text-white py-2">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D2025]">
                <tr>
                  <td className="py-3 pr-4 font-mono text-xs">sl_session</td>
                  <td className="py-3 pr-4">Essential</td>
                  <td className="py-3 pr-4">Maintains your authenticated session</td>
                  <td className="py-3">Session</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-mono text-xs">sl_csrf</td>
                  <td className="py-3 pr-4">Essential</td>
                  <td className="py-3 pr-4">CSRF protection token</td>
                  <td className="py-3">Session</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-mono text-xs">sl_prefs</td>
                  <td className="py-3 pr-4">Functional</td>
                  <td className="py-3 pr-4">Stores UI preferences (theme, language)</td>
                  <td className="py-3">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Managing Cookies</h2>
          <p>
            You can control and/or delete cookies as you wish via your browser settings. Disabling
            essential cookies may affect site functionality such as login sessions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">Contact</h2>
          <p>
            Questions about cookies:{' '}
            <a
              href="mailto:privacy@stellarlend.com"
              className="text-[#15A350] hover:underline"
            >
              privacy@stellarlend.com
            </a>
          </p>
        </section>

        <p className="text-sm italic">
          This page contains placeholder content while our full Cookie Policy is being reviewed.
        </p>
      </div>
    </StubPageLayout>
  );
}
