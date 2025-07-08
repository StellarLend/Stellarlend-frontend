import RecentTransactions from '@/components/shared/common/RecentTransactions';

export default function TransactionsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4">
        <RecentTransactions />
      </div>
    </main>
  );
} 