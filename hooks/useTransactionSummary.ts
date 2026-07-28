import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Transaction } from '@/lib/transactions/types';

export function useTransactionSummary() {
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState({ inflow: 0, outflow: 0, net: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function calculateSummary() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/transactions');
        const data = res.ok ? await res.json() : { transactions: [] };
        const allTransactions: Transaction[] = data.transactions ?? [];

        // Client-side filter by search/status/date params
        const search = (searchParams.get('search') || '').toLowerCase();
        const status = searchParams.get('status') || 'All';
        const dateFrom = searchParams.get('fromDate');
        const dateTo = searchParams.get('toDate');

        const filtered = allTransactions.filter((txn) => {
          if (search && !JSON.stringify(txn).toLowerCase().includes(search)) return false;
          if (status !== 'All' && (txn as any).status !== status) return false;
          if (dateFrom && new Date((txn as any).date) < new Date(dateFrom)) return false;
          if (dateTo && new Date((txn as any).date) > new Date(dateTo)) return false;
          return true;
        });

        // Compute totals
        let inflow = 0;
        let outflow = 0;
        
        filtered.forEach(txn => {
          if (txn.amount > 0) {
            inflow += txn.amount;
          } else {
            outflow += Math.abs(txn.amount);
          }
        });
        
        setSummary({
          inflow,
          outflow,
          net: inflow - outflow,
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    calculateSummary();
  }, [searchParams]);

  return { ...summary, isLoading };
}
