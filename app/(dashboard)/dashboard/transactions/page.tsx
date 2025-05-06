import ExportCsvButton from '@/components/table/ExportCsvButton';
import Table from '@/components/table/Table';
import { transactionsColumn } from '@/components/table/transactionsColumn';
import { Transaction } from '@/types';

export default async function TransactionsPage() {
  const sampleTransactions: Transaction[] = [
    { id: "TXN12345", type: "Deposit", amount: 2000, asset: "XLM", date: "2025-04-12", time: "09:32AM", status: "Completed" },
    { id: "TXN12346", type: "Loan Payment", amount: -250, asset: "BTC", date: "2025-03-10", time: "11:15AM", status: "Processing" },
    { id: "TXN12347", type: "Withdrawal", amount: -7500, asset: "STRK", date: "2025-02-28", time: "04:45PM", status: "Completed" },
    { id: "TXN12348", type: "Lend Funds", amount: -1500, asset: "XLM", date: "2025-01-05", time: "08:00AM", status: "Completed" },
    { id: "TXN12349", type: "Lend Funds", amount: -607.87, asset: "BTC", date: "2024-12-20", time: "10:20PM", status: "Failed" },
    { id: "TXN12350", type: "Deposit", amount: 20000, asset: "STRK", date: "2024-11-15", time: "01:05PM", status: "Completed" },
  ];

  const fetchTransactions = async (): Promise<Transaction[]> => {
    await new Promise((res) => setTimeout(res, 300));

    const transactions: Transaction[] = [];
    for (let i = 0; i < 40; i++) {
      const base = sampleTransactions[i % sampleTransactions.length];
      const baseIdNum = 12345 + i;
      const newTransaction: Transaction = {
        ...base,
        id: `TXN${baseIdNum}`,
      };
      transactions.push(newTransaction);
    }

    return transactions;
  };

  const transactions = await fetchTransactions()

  return (
    <div className="w-full min-h-screen overflow-hidden">
      <div className='flex justify-between items-center h-20 md:h-28 px-6 bg-brand-white md:bg-brand'>
        <h2 className='font-semibold text-xl text-brand-black-100 md:text-brand-white'>
          <span className='md:hidden'>Recent</span> Transactions
        </h2>

        <ExportCsvButton columns={ transactionsColumn } data={ transactions } />
      </div>
      <div className='w-full rounded-t-xl px-2 mb-6'>
        <Table data={ transactions } columns={ transactionsColumn } />
      </div>
      {/* <div className="mx-auto px-4">
         <RecentTransactions />
      </div> */}
    </div>
  );
} 