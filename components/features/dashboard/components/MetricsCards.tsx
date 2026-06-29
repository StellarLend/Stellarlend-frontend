"use client";

import { useState, useEffect, useMemo } from "react";
import { Copy, Search, X } from "lucide-react";
import ScrollCues from "@/components/atoms/ScrollCues/ScrollCues";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Toast } from "@/components/shared/common";
import { copyToClipboard, type CopyFailureReason } from "@/lib/utils/clipboard";
import { getAssets, type AssetMetadata } from "@/lib/assets/registry";

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

// ── Asset filter bar ──────────────────────────────────────────────────────────

interface AssetFilterBarProps {
  query: string;
  onChange: (value: string) => void;
  showing: number;
  total: number;
}

function AssetFilterBar({ query, onChange, showing, total }: AssetFilterBarProps) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <label htmlFor="asset-filter" className="sr-only">
          Filter assets
        </label>
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71B48D] pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="asset-filter"
          type="search"
          placeholder="Search assets…"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#0A3D1E] border border-[#71B48D33] rounded-lg pl-9 pr-9 py-2 text-sm text-white placeholder-[#71B48D] focus:outline-none focus:ring-2 focus:ring-[#097C4C]"
        />
        {query && (
          <button
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71B48D] hover:text-white"
            aria-label="Clear filter"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <span className="text-[#AAABAB] text-sm whitespace-nowrap" aria-live="polite">
        Showing {showing} of {total}
      </span>
    </div>
  );
}

// ── Asset metric card (per-asset breakdown) ───────────────────────────────────

function AssetCard({ asset }: { asset: AssetMetadata }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div
      className={`bg-[#097C4C] rounded-xl p-4 border border-[#71B48D33] ${
        shouldReduceMotion ? "" : "transform transition-transform hover:scale-[1.02]"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <img src={asset.logoUrl} alt={`${asset.name} logo`} className="w-6 h-6 rounded-full" />
        <span className="text-white text-sm font-semibold">{asset.symbol}</span>
      </div>
      <p className="text-[#D4F3E6] text-xs">{asset.name}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MetricsCards() {
  const [data, setData] = useState<any>(null);
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    fetch("/api/positions")
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const allAssets = useMemo(() => {
    try {
      return getAssets();
    } catch {
      return [];
    }
  }, []);

  const filteredAssets = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return allAssets;
    return allAssets.filter(
      (a) =>
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q),
    );
  }, [allAssets, filterQuery]);

  if (!data) return <div className="text-white p-4 text-sm font-medium">Loading metrics…</div>;

  return (
    <div>
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

      {/* Asset filter + breakdown */}
      <div className="mt-6">
        <AssetFilterBar
          query={filterQuery}
          onChange={setFilterQuery}
          showing={filteredAssets.length}
          total={allAssets.length}
        />

        {filteredAssets.length === 0 ? (
          <div
            role="status"
            className="text-[#AAABAB] text-sm py-6 text-center"
          >
            No assets match &ldquo;{filterQuery}&rdquo;.{" "}
            <button
              onClick={() => setFilterQuery("")}
              className="underline text-[#71B48D] hover:text-white"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredAssets.map((asset) => (
              <AssetCard key={asset.symbol} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}