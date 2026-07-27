import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface TransactionSummary {
  inflow: number;
  outflow: number;
  net: number;
}

export function useTransactionSummary() {
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<TransactionSummary>({ inflow: 0, outflow: 0, net: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function calculateSummary() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        const search = searchParams.get('search');
        const status = searchParams.get('status');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        if (search) params.set('search', search);
        if (status && status !== 'All') params.set('status', status);
        if (fromDate) params.set('dateFrom', fromDate);
        if (toDate) params.set('dateTo', toDate);
        params.set('pageSize', '1000');

        const res = await fetch(`/api/transactions?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch transactions');
        const data = await res.json();
        const transactions: Array<{ amount: number }> = data.transactions ?? [];

        let inflow = 0;
        let outflow = 0;

        for (const txn of transactions) {
          if (txn.amount > 0) {
            inflow += txn.amount;
          } else {
            outflow += Math.abs(txn.amount);
          }
        }

        if (!cancelled) {
          setSummary({ inflow, outflow, net: inflow - outflow });
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSummary({ inflow: 0, outflow: 0, net: 0 });
          setIsLoading(false);
        }
      }
    }

    calculateSummary();
    return () => { cancelled = true; };
  }, [searchParams]);

  return { ...summary, isLoading };
}
