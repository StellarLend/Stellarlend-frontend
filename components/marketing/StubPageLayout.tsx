import Link from 'next/link';

interface StubPageLayoutProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/**
 * Minimal layout wrapper used by marketing stub pages (features, pricing, legal, etc.)
 * while full content is being developed. Provides a consistent header and footer
 * back to the home page so the site never hard 404s on linked pages.
 */
export default function StubPageLayout({
  title,
  description,
  children,
}: StubPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col">
      {/* Minimal top nav */}
      <header className="border-b border-[#1D2025]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-white hover:text-[#15A350] transition-colors"
          >
            Stellarlend
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[#AAABAB]">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              App
            </Link>
            <Link href="/lending" className="hover:text-white transition-colors">
              Lending
            </Link>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        {description && (
          <p className="text-[#AAABAB] text-lg mb-10">{description}</p>
        )}
        {children}
      </main>

      {/* Minimal bottom bar */}
      <footer className="border-t border-[#1D2025]">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#AAABAB]">
          <span>&copy; {new Date().getFullYear()} Stellarlend. All rights reserved.</span>
          <Link href="/" className="hover:text-white transition-colors">
            &larr; Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}
