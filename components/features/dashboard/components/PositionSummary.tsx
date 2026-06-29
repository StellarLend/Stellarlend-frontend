"use client";

import { useMemo } from "react";
import { AlertCircle, TrendingUp } from "lucide-react";
import SupplyApyChart from "./SupplyApyChart";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CollateralBreakdown } from "./CollateralBreakdown";
import { useCollateralShares } from "@/hooks/usePositions";

interface PositionData {
  suppliedFunds: string;
  borrowedAmount: string;
  healthFactor: number;
}

interface PositionSummaryProps {
  data: PositionData | null;
  isLoading?: boolean;
}

/**
 * Determines health status based on health factor value
 * Health Factor ranges:
 * - >= 2.0: Healthy (comfortable buffer)
 * - 1.0 - 2.0: At Risk (approaching danger zone)
 * - < 1.0: Critical (liquidation risk)
 */
function getHealthStatus(healthFactor: number): {
  status: "healthy" | "at-risk" | "critical";
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconBgColor: string;
} {
  if (healthFactor >= 2.0) {
    return {
      status: "healthy",
      label: "Healthy",
      description: "Your position is well-protected",
      color: "text-emerald-400",
      bgColor: "bg-emerald-950",
      borderColor: "border-emerald-700",
      iconBgColor: "bg-emerald-900",
    };
  }

  if (healthFactor >= 1.0) {
    return {
      status: "at-risk",
      label: "At Risk",
      description: "Consider reducing borrowed amount",
      color: "text-amber-400",
      bgColor: "bg-amber-950",
      borderColor: "border-amber-700",
      iconBgColor: "bg-amber-900",
    };
  }

  return {
    status: "critical",
    label: "Critical",
    description: "Risk of liquidation - take action",
    color: "text-red-400",
    bgColor: "bg-red-950",
    borderColor: "border-red-700",
    iconBgColor: "bg-red-900",
  };
}

/**
 * Parses formatted currency string and extracts numeric value
 * Handles formats like "$5,000.00 XLM" → 5000
 */
function parseFormattedCurrency(formatted: string): number {
  const numericStr = formatted.replace(/[^\d.-]/g, "");
  const num = parseFloat(numericStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats a number as currency with proper grouping
 * Uses tabular numerals for consistent alignment in UI
 */
function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * PositionSummary Component
 *
 * Displays the user's net lending position (supplied minus borrowed)
 * and account health status at a glance.
 *
 * Accessibility features:
 * - ARIA labels for screen readers
 * - Semantic HTML structure
 * - High contrast for health indicators
 * - Non-color-dependent status communication
 */
export const PositionSummary: React.FC<PositionSummaryProps> = ({
  data,
  isLoading = false,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { shares, isLoading: sharesLoading } = useCollateralShares();
  const {
    netPosition,
    formattedNetPosition,
    healthStatus,
    supplied,
    borrowed,
  } = useMemo(() => {
    if (!data || isLoading) {
      return {
        netPosition: 0,
        formattedNetPosition: "$0.00",
        healthStatus: getHealthStatus(0),
        supplied: 0,
        borrowed: 0,
      };
    }

    const suppliedNum = parseFormattedCurrency(data.suppliedFunds);
    const borrowedNum = parseFormattedCurrency(data.borrowedAmount);
    const net = suppliedNum - borrowedNum;

    return {
      netPosition: net,
      formattedNetPosition: formatCurrencyValue(net),
      healthStatus: getHealthStatus(data.healthFactor),
      supplied: suppliedNum,
      borrowed: borrowedNum,
    };
  }, [data, isLoading]);

  if (isLoading) {
    return (
      <div
        className={`bg-gradient-to-br from-[#0A3D1E] to-[#06613D] rounded-xl p-8 md:p-12 border border-[#71B48D33] ${
          shouldReduceMotion ? "" : "animate-pulse"
        }`}
        role="status"
        aria-label="Loading position summary"
      >
        <div className="h-12 bg-[#71B48D33] rounded w-32 mb-6" />
        <div className="h-8 bg-[#71B48D33] rounded w-48 mb-8" />
        <div className="h-6 bg-[#71B48D33] rounded w-40" />
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="bg-[#0A3D1E] rounded-xl p-8 md:p-12 border border-[#71B48D33]"
        role="alert"
      >
        <p className="text-[#AAABAB] text-sm font-medium">
          Unable to load position summary
        </p>
      </div>
    );
  }

  const isPositive = netPosition >= 0;
  const trend = data.healthFactor >= 2.0 ? "improving" : "worsening";

  return (
    <div
      className={`bg-gradient-to-br from-[#0A3D1E] to-[#06613D] rounded-xl p-8 md:p-12 border border-[#71B48D33] mb-8 hover:border-[#71B48D66] ${
        shouldReduceMotion ? "" : "transition-colors"
      }`}
      role="region"
      aria-label="Position summary"
    >
      {/* Main Position Display */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <span className="text-[#D4F3E6] text-sm font-medium">
            Net Position
          </span>
        </div>

        {/* Large Number Display */}
        <div
          className="text-white text-5xl md:text-6xl font-bold mb-2 font-mono"
          aria-label={`Net position: ${formattedNetPosition}`}
        >
          {formattedNetPosition}
        </div>

        <p className="text-[#AAABAB] text-sm font-medium">
          {isPositive
            ? "Supplied funds exceed borrowed amount"
            : "Borrowed amount exceeds supplied funds"}
        </p>
      </div>

      {/* Health Indicator Card */}
      <div
        className={`
          ${healthStatus.bgColor} rounded-lg p-4 border ${healthStatus.borderColor}
          flex items-start gap-4
        `}
        role="article"
        aria-label={`Health status: ${healthStatus.label}`}
      >
        {/* Icon Container */}
        <div
          className={`
            ${healthStatus.iconBgColor} rounded-md flex items-center 
            justify-center w-10 h-10 flex-shrink-0 mt-0.5
          `}
        >
          {healthStatus.status === "critical" ? (
            <AlertCircle className={`w-5 h-5 ${healthStatus.color}`} />
          ) : (
            <div
              className={`w-5 h-5 rounded-full border-2 ${healthStatus.color}`}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className={`${healthStatus.color} text-base font-bold`}
              id="health-status-label"
            >
              {healthStatus.label}
            </h3>
            <span
              className={`${healthStatus.color} text-xs font-semibold px-2 py-1 rounded`}
              aria-label={`Health factor: ${data.healthFactor.toFixed(2)}`}
            >
              {data.healthFactor.toFixed(2)}x
            </span>
          </div>
          <p className="text-[#AAABAB] text-sm font-medium">
            {healthStatus.description}
          </p>
        </div>
      </div>

      {/* Breakdown Section */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-2 gap-4">
        <div
          className="bg-[#072815] rounded-lg p-3 border border-[#71B48D33]"
          aria-label={`Total supplied: ${data.suppliedFunds}`}
        >
          <p className="text-[#AAABAB] text-xs font-medium mb-1">Supplied</p>
          <p className="text-white text-base md:text-lg font-bold font-mono">
            {data.suppliedFunds}
          </p>
        </div>

        <div
          className="bg-[#072815] rounded-lg p-3 border border-[#71B48D33]"
          aria-label={`Total borrowed: ${data.borrowedAmount}`}
        >
          <p className="text-[#AAABAB] text-xs font-medium mb-1">Borrowed</p>
          <p className="text-white text-base md:text-lg font-bold font-mono">
            {data.borrowedAmount}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SupplyApyChart className="w-full" />
      </div>
      {/* Collateral Breakdown */}
      <CollateralBreakdown shares={shares} isLoading={sharesLoading} />

      {/* Screen reader only summary */}
      <div className="sr-only">
        Net position is {formattedNetPosition}. Account health status is
        {healthStatus.label}. {healthStatus.description}. Total supplied is
        {data.suppliedFunds} and total borrowed is {data.borrowedAmount}.
      </div>
    </div>
  );
};

export default PositionSummary;
