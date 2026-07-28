"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/shared/common/Toast";
import { serializeTransactionFilters } from "@/lib/transactions/filters";
import type { TransactionFilters } from "@/lib/transactions/types";

interface TransactionExportButtonProps {
  filters: TransactionFilters;
  className?: string;
}

function buildExportUrl(filters: TransactionFilters): string {
  const params = serializeTransactionFilters({
    asset: filters.asset,
    type: filters.type,
    status: filters.status && filters.status !== "All" ? filters.status : undefined,
    fromDate: filters.dateFrom,
    toDate: filters.dateTo,
  });

  if (filters.search) params.set("search", filters.search);

  const query = params.toString();
  return query ? `/api/transactions/export?${query}` : "/api/transactions/export";
}

export function TransactionExportButton({ filters, className = "" }: TransactionExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      const response = await fetch(buildExportUrl(filters), { method: "GET" });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        showToast({
          title: "Export failed",
          description: errorPayload?.error ?? "Unable to prepare your CSV export.",
          variant: "error",
        });
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] ?? "transactions.csv";
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast({
        title: "Export ready",
        description: "Your transaction history CSV has been downloaded.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to prepare your CSV export.",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      aria-busy={isExporting}
      className={`bg-[#15A350] hover:bg-[#0A3D1E] text-white border border-[#71B48D] rounded-lg flex items-center justify-center gap-2 py-3 px-6 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Preparing…</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </>
      )}
    </button>
  );
}

export default TransactionExportButton;
