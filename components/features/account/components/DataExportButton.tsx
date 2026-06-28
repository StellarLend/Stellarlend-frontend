"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import Toast, { ToastVariant } from "@/components/shared/common/Toast";

interface DataExportButtonProps {
  className?: string;
}

export default function DataExportButton({ className = "" }: DataExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{
    variant: ToastVariant;
    title: string;
    description?: string;
  } | null>(null);

  const showToast = (variant: ToastVariant, title: string, description?: string) => {
    setToast({ variant, title, description });
    setTimeout(() => setToast(null), 5000);
  };

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    showToast("processing", "Preparing your data export...", "This may take a moment.");

    try {
      const response = await fetch("/api/account/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          showToast(
            "error",
            "Export rate limit exceeded",
            data.error || "Please wait 24 hours before requesting another export."
          );
        } else {
          showToast(
            "error",
            "Export failed",
            data.error || "An error occurred while preparing your export."
          );
        }
        return;
      }

      // Trigger download if downloadUrl is provided
      if (data.downloadUrl) {
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = `stellarlend-export-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        showToast(
          "success",
          "Export ready",
          "Your data export has been downloaded successfully."
        );
      } else {
        showToast(
          "error",
          "Export incomplete",
          "No download URL received. Please try again."
        );
      }
    } catch (error) {
      showToast(
        "error",
        "Export failed",
        "Network error occurred. Please check your connection and try again."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors ${className}`}
        aria-busy={isExporting}
        aria-describedby={isExporting ? "export-status" : undefined}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Preparing...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Export My Data</span>
          </>
        )}
      </button>
      
      {isExporting && (
        <span id="export-status" className="sr-only">
          Your data export is being prepared. Please wait.
        </span>
      )}

      {toast && (
        <Toast
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
        />
      )}
    </>
  );
}
