"use client";

import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import ScrollCues from "@/components/atoms/ScrollCues/ScrollCues";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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

  const handleCopy = () => {
    if (copyValue) {
      navigator.clipboard.writeText(copyValue);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
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
                  e.stopPropagation(); // Prevent bubbling to parent
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
    </div>
  );
};

export default function MetricsCards() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/positions")
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) return <div className="text-white p-4 text-sm font-medium">Loading metrics...</div>;

  return (
    <ScrollCues className="w-full" role="region" aria-label="Scrollable metrics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          isPrimary
          icon={<img src="/icons/piggy.svg" alt="Wallet Icon" className="w-6 h-6" />}
          label="Available Balance"
          value={data.availableBalance}
          copyValue={data.copyAddress}
        />
        <MetricCard
          icon={<img src="/icons/Icon-11.svg" alt="Dollar Icon" className="w-6 h-6" />}
          label="Total Borrowed Amount"
          value={data.borrowedAmount}
          subLabel="Next Due Payment"
          subValue={data.nextDue}
        />
        <MetricCard
          icon={<img src="/icons/Icon-11.svg" alt="Dollar Icon" className="w-6 h-6" />}
          label={`Total Supplied (Health Factor: ${data.healthFactor})`}
          value={data.suppliedFunds}
          subLabel="Earnings from Lending"
          subValue={data.earnings}
        />
      </div>
    </ScrollCues>
  );
}