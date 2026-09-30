import type { Metadata } from 'next';
import StubPageLayout from '@/components/marketing/StubPageLayout';

export const metadata: Metadata = {
  title: 'API Reference | Stellarlend',
  description: 'REST API reference for integrating with the Stellarlend protocol.',
};

const endpoints = [
  { method: 'GET', path: '/api/health', description: 'Platform & Stellar network health check.' },
  { method: 'GET', path: '/api/prices', description: 'Asset spot prices (cached 5 s).' },
  { method: 'GET', path: '/api/markets', description: 'Per-asset supply/borrow APR & utilization.' },
  { method: 'GET', path: '/api/positions', description: 'User lending/borrowing positions.' },
  { method: 'GET/POST', path: '/api/transactions', description: 'Transaction history and creation.' },
  { method: 'GET', path: '/api/transactions/export', description: 'Export transactions as CSV.' },
  { method: 'POST', path: '/api/quote', description: 'Lending/borrowing quote calculation.' },
];

const methodColour: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PATCH: 'text-yellow-400',
  DELETE: 'text-red-400',
  'GET/POST': 'text-purple-400',
};

export default function ApiDocsPage() {
  return (
    <StubPageLayout
      title="API Reference"
      description="REST endpoints for integrating with Stellarlend."
    >
      <div className="space-y-6 text-[#AAABAB]">
        <p className="text-sm">
          Base URL: <code className="bg-[#1D2025] px-2 py-0.5 rounded font-mono text-white">https://app.stellarlend.com</code>
        </p>

        <div className="border border-[#1D2025] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1D2025] bg-[#1D2025]/50">
                <th className="text-left text-white py-3 px-4 font-semibold">Method</th>
                <th className="text-left text-white py-3 px-4 font-semibold">Path</th>
                <th className="text-left text-white py-3 px-4 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D2025]">
              {endpoints.map((ep) => (
                <tr key={ep.path} className="hover:bg-[#1D2025]/30">
                  <td className={`py-3 px-4 font-mono font-semibold ${methodColour[ep.method] ?? 'text-white'}`}>
                    {ep.method}
                  </td>
                  <td className="py-3 px-4 font-mono text-white">{ep.path}</td>
                  <td className="py-3 px-4">{ep.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm italic">
          Full OpenAPI spec available in the repository at{' '}
          <a
            href="https://github.com/stellarlend"
            className="text-[#15A350] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/stellarlend
          </a>
          .
        </p>
      </div>
    </StubPageLayout>
  );
}
