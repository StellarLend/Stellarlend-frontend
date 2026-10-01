"use client";

import { useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components";
import { PageHeader } from "@/components/shared/common";
import MetricsCards from "@/components/features/dashboard/components/MetricsCards";
import { SupplyApyChart } from "@/components/features/dashboard/components/SupplyApyChart";
import NetWorthTrend from "@/components/features/dashboard/components/NetWorthTrend";
import { useToast } from "@/components/shared/common/Toast";
import { serializeTransactionsToCSV } from "@/lib/transactions/csv";
import type { Transaction } from "@/lib/transactions/types";

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function fetchAnalyticsData(): Promise<Transaction[]> {
  const response = await fetch("/api/transactions", { method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to fetch transactions");
  }
  const data = await response.json();
  return Array.isArray(data?.transactions) ? data.transactions : [];
}

function ExportCsvButton() {
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const transactions = await fetchAnalyticsData();
      const csv = serializeTransactionsToCSV(transactions);
      downloadBlob(csv, "analytics.csv", "text/csv;charset=utf-8;");
      showToast({
        title: "Export ready",
        description: "Your analytics CSV has been downloaded.",
        variant: "success",
      });
    } catch {
      showToast({
        title: "Export failed",
        description: "Unable to prepare your CSV export. Please try again.",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, showToast]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      aria-busy={isExporting}
      className="bg-[#15A350] hover:bg-[#0A3D1E] text-white border border-[#71B48D] rounded-lg flex items-center justify-center gap-2 py-3 px-6 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Preparing…</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>Export CSV</span>
        </>
      )}
    </button>
  );
}

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="pt-10 border-t px-6 md:px-12">
        <PageHeader
          title="Analytics"
          description="Visualise your lending, borrowing, and collateral activity over time."
          actions={<ExportCsvButton />}
        />
      </div>

      <div className="px-6 md:px-12 mt-6 space-y-6">
        <NetWorthTrend />
        <MetricsCards />
        <SupplyApyChart />
      </div>
    </DashboardLayout>
  );
}
