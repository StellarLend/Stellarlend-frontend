import React, { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils/format';

export interface UtilizationBarProps {
  asset: string;
}

export function UtilizationBar({ asset }: UtilizationBarProps) {
  const [utilization, setUtilization] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch('/api/markets')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const marketData = data.find((m: any) => m.asset === asset);
        if (marketData && typeof marketData.utilization === 'number') {
          // Ensure within 0-100 range
          setUtilization(Math.max(0, Math.min(100, marketData.utilization)));
        } else {
          setUtilization(null);
        }
      })
      .catch(() => {
        if (isMounted) setUtilization(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [asset]);

  if (isLoading) {
    return <div data-testid={`utilization-loading-${asset}`} className="h-4 w-16 bg-slate-800 animate-pulse rounded"></div>;
  }

  if (utilization === null) {
    return <div data-testid={`utilization-missing-${asset}`} className="text-xs text-slate-500">N/A</div>;
  }

  // Format percentage safely without just relying on color
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  return (
    <div className="flex items-center gap-2" data-testid={`utilization-bar-${asset}`}>
      <div className="w-16 h-2 bg-slate-800 rounded overflow-hidden">
        <div 
          className="h-full bg-blue-500"
          style={{ width: `${utilization}%` }}
        />
      </div>
      <span className="text-xs font-mono">{formatPercent(utilization)}</span>
    </div>
  );
}
