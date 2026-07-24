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
        const query = searchParams.toString();
        const response = await fetch(`/api/transactions${query ? `?${query}` : ''}`);

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        const transactions: Transaction[] = data.transactions || data;

        let inflow = 0;
        let outflow = 0;

        transactions.forEach((txn) => {
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
      } catch (error) {
        console.error('Error fetching transaction summary:', error);
      } finally {
        setIsLoading(false);
      }
    }

    calculateSummary();
  }, [searchParams]);

  return { ...summary, isLoading };
}