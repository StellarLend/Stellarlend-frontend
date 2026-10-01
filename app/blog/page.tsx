import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'Blog | Stellarlend',
  description: 'Updates, insights, and deep-dives from the Stellarlend team.',
};

export default function BlogPage() {
  return (
    <StubPageLayout
      title="Blog"
      description="Updates, insights, and deep-dives from the Stellarlend team."
    >
      <div className="border border-dashed border-[#1D2025] rounded-xl p-12 text-center text-[#AAABAB]">
        <div className="text-4xl mb-4" aria-hidden="true">✍️</div>
        <h2 className="text-xl font-semibold text-white mb-2">Blog launching soon</h2>
        <p className="max-w-md mx-auto">
          Articles covering DeFi on Stellar, protocol mechanics, security research, and
          ecosystem news are on the way. Subscribe to be notified when we publish.
        </p>
        <a
          href="/"
          className="inline-block mt-6 px-6 py-3 bg-[#15A350] hover:bg-[#128F42] text-white font-semibold rounded-lg transition-colors"
        >
          Back to home
        </a>
      </div>
    </StubPageLayout>
  );
}
