import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchTransactions, filterTransactions } from '@/lib/transactions/repository';
import type { Transaction, TransactionFilters } from '@/lib/transactions/types';

export function useTransactionSummary() {
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState({ inflow: 0, outflow: 0, net: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function calculateSummary() {
      setIsLoading(true);
      const allTransactions = await fetchTransactions();
      
      // Filter transactions
      const filters: TransactionFilters = {
          search: searchParams.get('search') || '',
          status: (searchParams.get('status') as any) || 'All',
          dateFrom: searchParams.get('fromDate') || undefined,
          dateTo: searchParams.get('toDate') || undefined,
      };

      const filtered = filterTransactions(allTransactions as any, filters);

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
      setIsLoading(false);
    }
    
    calculateSummary();
  }, [searchParams]);

  return { ...summary, isLoading };
}
