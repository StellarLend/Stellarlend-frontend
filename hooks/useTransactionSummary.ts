import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchTransactions } from '@/types/Transaction';
import type { FetchTransactionsOptions } from '@/types/Transaction';
import { isTransactionStatus } from '@/types/enums';

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
        const filters: FetchTransactionsOptions = {};

        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const type = searchParams.get('type');
        const asset = searchParams.get('asset');

        if (status && isTransactionStatus(status)) {
          filters.status = status;
        }
        if (search) filters.search = search;
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;
        if (type) filters.type = type;
        if (asset) filters.asset = asset;

        const response = await fetchTransactions(filters);
        const transactions = response.transactions;

        let inflow = 0;
        let outflow = 0;

        transactions.forEach((txn) => {
          if (txn.amount > 0) {
            inflow += txn.amount;
          } else {
            outflow += Math.abs(txn.amount);
          }
        });

        if (!cancelled) {
          setSummary({ inflow, outflow, net: inflow - outflow });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching transaction summary:', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    calculateSummary();
    return () => { cancelled = true; };
  }, [searchParams]);

  return { ...summary, isLoading };
}