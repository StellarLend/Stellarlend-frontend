"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy } from "lucide-react";
import ScrollCues from "@/components/atoms/ScrollCues/ScrollCues";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Toast } from "@/components/shared/common";
import { copyToClipboard, type CopyFailureReason } from "@/lib/utils/clipboard";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subLabel?: string;
  subValue?: string;
  copyValue?: string;
  isPrimary?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  subLabel,
  subValue,
  copyValue,
  isPrimary = false,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const [toast, setToast] = useState<{
    variant: "error" | "info";
    title: string;
    description: string;
  } | null>(null);

  const handleCopy = async () => {
    if (!copyValue) return;

    const result = await copyToClipboard(copyValue, true);

    if (result.success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      return;
    }

    const messages: Record<CopyFailureReason, { title: string; description: string }> = {
      invalid_address: {
        title: "Invalid Address",
        description: "The wallet address could not be validated before copying.",
      },
      clipboard_error: {
        title: "Copy Failed",
        description: "Clipboard access is unavailable. Try copying the address manually.",
      },
    };

    setToast({
      variant: "error",
      ...messages[result.reason!],
    });
    setTimeout(() => setToast(null), 4000);
  };

  const cardBg = isPrimary ? "bg-[#0A3D1E]" : "bg-[#097C4C]";
  const subBg = isPrimary ? "bg-[#072815]" : "bg-[#06613D]";
  const textColor = "text-white";
  const subLabelColor = isPrimary ? "text-[#AAABAB]" : "text-[#D4F3E6]";
  const iconBgColor = isPrimary ? "bg-[#14532D]" : "bg-[#065F3A]";

  return (
    <div
      className={`
        ${cardBg} rounded-xl overflow-hidden p-4 w-full border-[#71B48D33] my-6
        cursor-pointer ${shouldReduceMotion ? "" : "transform transition-transform hover:scale-[1.02] active:scale-[1.03]"}
      `}
    >
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-opacity-20 rounded-md flex items-center justify-center">
            {icon}
          </div>
          <span className={`${textColor} text-sm font-medium`}>{label}</span>
        </div>
        <h3 className={`${textColor} text-[28px] font-bold mb-4`}>
          {value}
        </h3>
      </div>

      {(subLabel || copyValue) && (
        <div
          className={`${subBg} h-14 px-6 text-sm flex items-center rounded-xl justify-between`}
        >
          {subLabel && subValue ? (
            <div className="flex items-center gap-1">
              <span className={`${subLabelColor} text-sm font-medium`}>
                {subLabel}
              </span>
              <span className="text-white font-medium">·</span>
              <span className={`${textColor} text-sm font-medium`}>
                {subValue}
              </span>
            </div>
          ) : copyValue ? (
            <div className="flex items-center justify-between w-full min-w-0 flex-nowrap">
              <div className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                <span
                  className={`${subLabelColor} text-sm font-medium shrink-0`}
                >
                  Copy Address
                </span>
                <span className="text-white font-medium shrink-0">·</span>
                <span className={`${textColor} text-sm font-medium truncate`}>
                  {copyValue}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className={`${iconBgColor} hover:bg-opacity-80 rounded-md w-9 h-9 flex items-center justify-center transition-all ml-2 shrink-0`}
                aria-label="Copy address to clipboard"
              >
                {isCopied ? (
                  <span className="text-green-200 text-xs">Copied!</span>
                ) : (
                  <Copy size={20} className="text-green-100" />
                )}
              </button>
            </div>
          ) : null}
        </div>
      )}
      {toast && (
        <Toast
          variant={toast.variant}
          title={toast.title}
          description={toast.description}
        />
      )}
    </div>
  );
};

/** Skeleton placeholder shown while positions are loading. */
const SkeletonCard: React.FC<{ isPrimary?: boolean }> = ({ isPrimary = false }) => {
  const cardBg = isPrimary ? "bg-[#0A3D1E]" : "bg-[#097C4C]";
  const shimmer = "animate-pulse bg-white/10 rounded";
  return (
    <div className={`${cardBg} rounded-xl overflow-hidden p-4 w-full border-[#71B48D33] my-6`}>
      <div className={`${shimmer} h-4 w-32 mb-4`} />
      <div className={`${shimmer} h-8 w-40 mb-4`} />
      <div className={`${shimmer} h-14 w-full rounded-xl`} />
    </div>
  );
};

interface PositionsData {
  availableBalance: string;
  copyAddress: string;
  borrowedAmount: string;
  nextDue: string;
  suppliedFunds: string;
  earnings: string;
  healthFactor: number | string;
}

function usePositionsData(): { data: PositionsData | null; isLoading: boolean; error: Error | null } {
  const [data, setData] = useState<PositionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/positions");
      if (!res.ok) throw new Error(`Failed to fetch positions: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error };
}

export default function MetricsCards() {
  const { data, isLoading, error } = usePositionsData();

  if (isLoading) {
    return (
      <ScrollCues className="w-full" role="region" aria-label="Scrollable metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard isPrimary />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </ScrollCues>
    );
  }

  if (error) {
    return (
      <ScrollCues className="w-full" role="region" aria-label="Scrollable metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            isPrimary
            icon={<img src="/icons/piggy.svg" alt="Wallet Icon" className="w-6 h-6" />}
            label="Available Balance"
            value="—"
          />
          <MetricCard
            icon={<img src="/icons/Icon-11.svg" alt="Dollar Icon" className="w-6 h-6" />}
            label="Total Borrowed Amount"
            value="—"
          />
          <MetricCard
            icon={<img src="/icons/Icon-11.svg" alt="Dollar Icon" className="w-6 h-6" />}
            label="Total Supplied"
            value="—"
          />
        </div>
      </ScrollCues>
    );
  }

  const availableBalance = data?.availableBalance ?? "$0.00";
  const copyAddress = data?.copyAddress ?? "";
  const borrowedAmount = data?.borrowedAmount ?? "$0.00";
  const nextDue = data?.nextDue ?? "—";
  const suppliedFunds = data?.suppliedFunds ?? "$0.00";
  const earnings = data?.earnings ?? "$0.00";
  const healthFactor = data?.healthFactor != null ? String(data.healthFactor) : "—";

  return (
    <ScrollCues className="w-full" role="region" aria-label="Scrollable metrics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          isPrimary
          icon={<img src="/icons/piggy.svg" alt="Wallet Icon" className="w-6 h-6" />}
          label="Available Balance"
          value={availableBalance}
          copyValue={copyAddress || undefined}
        />
        <MetricCard
          icon={<img src="/icons/Icon-11.svg" alt="Dollar Icon" className="w-6 h-6" />}
          label="Total Borrowed Amount"
          value={borrowedAmount}
          subLabel="Next Due Payment"
          subValue={nextDue}
        />
        <MetricCard
          icon={<img src="/icons/Icon-11.svg" alt="Dollar Icon" className="w-6 h-6" />}
          label={`Total Supplied (Health Factor: ${healthFactor})`}
          value={suppliedFunds}
          subLabel="Earnings from Lending"
          subValue={earnings}
        />
      </div>
    </ScrollCues>
  );
}
