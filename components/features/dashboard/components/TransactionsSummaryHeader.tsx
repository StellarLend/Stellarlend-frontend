import React from 'react';
import { formatCurrency } from '@/lib/utils/format';

interface TransactionsSummaryHeaderProps {
  inflow: number;
  outflow: number;
  net: number;
  isLoading: boolean;
}

export const TransactionsSummaryHeader = ({
  inflow,
  outflow,
  net,
  isLoading,
}: TransactionsSummaryHeaderProps) => {
  if (isLoading) {
    return <div className="px-6 md:px-12 mt-4 text-sm text-gray-500">Loading summary...</div>;
  }

  return (
    <div className="px-6 md:px-12 mt-4 flex gap-6 text-sm">
      <div className="flex flex-col">
        <span className="text-gray-500">Total Inflow</span>
        <span className="text-green-600 font-semibold">{formatCurrency(inflow)}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-gray-500">Total Outflow</span>
        <span className="text-red-600 font-semibold">{formatCurrency(outflow)}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-gray-500">Net</span>
        <span className={`font-semibold ${net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
          {formatCurrency(net)}
        </span>
      </div>
    </div>
  );
};
