"use client";

import { useState, useMemo } from "react";
import type {
  AmortizationPeriod,
  AmortizationSchedule,
} from "@/lib/lending/amortization";
import {
  formatCurrency,
  shouldCollapseSchedule,
} from "@/lib/lending/amortization";
import { Tooltip } from "@/components/atoms/Tooltip/Tooltip";
import { IconButton } from "@/components/atoms/IconButton/IconButton";

interface AmortizationScheduleProps {
  schedule: AmortizationSchedule;
}

export default function AmortizationSchedule({
  schedule,
}: AmortizationScheduleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { periods, monthlyPayment, totalInterest, totalRepayment } = schedule;

  const shouldCollapse = useMemo(
    () => shouldCollapseSchedule(periods),
    [periods],
  );

  const visiblePeriods = useMemo(() => {
    if (!shouldCollapse || isExpanded) {
      return periods;
    }
    // Show first 2 and last 2 periods
    if (periods.length <= 4) {
      return periods;
    }
    return [periods[0], periods[1], ...periods.slice(-2)];
  }, [periods, shouldCollapse, isExpanded]);

  const hasCollapsedMiddle =
    shouldCollapse && !isExpanded && periods.length > 4;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Amortization Schedule
        <Tooltip content="Breakdown of each payment showing principal and interest portions.">
          <IconButton aria-label="Help" size="sm" variant="ghost" />
        </Tooltip>
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Monthly Payment</div>
          <div className="text-sm font-semibold text-gray-900">
            {formatCurrency(monthlyPayment)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Total Interest</div>
          <div className="text-sm font-semibold text-gray-900">
            {formatCurrency(totalInterest)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Total Repayment</div>
          <div className="text-sm font-semibold text-gray-900">
            {formatCurrency(totalRepayment)}
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm"
          role="table"
          aria-label="Amortization schedule"
        >
          <thead>
            <tr className="border-b border-gray-200">
              <th
                className="text-left py-2 px-3 font-medium text-gray-700"
                scope="col"
              >
                Period
              </th>
              <th
                className="text-right py-2 px-3 font-medium text-gray-700"
                scope="col"
              >
                Principal
              </th>
              <th
                className="text-right py-2 px-3 font-medium text-gray-700"
                scope="col"
              >
                Interest
              </th>
              <th
                className="text-right py-2 px-3 font-medium text-gray-700"
                scope="col"
              >
                Payment
              </th>
              <th
                className="text-right py-2 px-3 font-medium text-gray-700"
                scope="col"
              >
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {visiblePeriods.map((period) => (
              <tr
                key={period.period}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td
                  className="py-2 px-3 text-gray-900"
                  data-testid={`period-${period.period}`}
                >
                  {period.period}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">
                  {formatCurrency(period.principal)}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">
                  {formatCurrency(period.interest)}
                </td>
                <td className="py-2 px-3 text-right font-medium text-gray-900">
                  {formatCurrency(period.principal + period.interest)}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">
                  {formatCurrency(period.remainingBalance)}
                </td>
              </tr>
            ))}

            {/* Collapsed middle indicator */}
            {hasCollapsedMiddle && (
              <tr className="border-b border-gray-100 bg-gray-50">
                <td
                  colSpan={5}
                  className="py-3 px-3 text-center text-gray-500 text-sm"
                >
                  ... {periods.length - 4} more periods ...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Expand/Collapse Button */}
      {shouldCollapse && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            aria-expanded={isExpanded}
            aria-controls="amortization-schedule-table"
          >
            {isExpanded ? (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
                Show Less
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Show Full Schedule ({periods.length} periods)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
