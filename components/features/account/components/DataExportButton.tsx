"use client";

import React, { useState } from "react";
import { Download } from "lucide-react";
import Button from "@/components/atoms/Button";
import Toast, { ToastVariant } from "@/components/shared/common/Toast";

interface DataExportButtonProps {
  className?: string;
}

export default function DataExportButton({ className = "" }: DataExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
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
    setHasFailed(false);
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
        setHasFailed(true);
        return;
      }

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
        setHasFailed(true);
        showToast(
          "error",
          "Export incomplete",
          "No download URL received. Please try again."
        );
      }
    } catch (error) {
      setHasFailed(true);
      showToast(
        "error",
        "Export failed",
        "Network error occurred. Please check your connection and try again."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const buttonLabel = isExporting ? "Preparing..." : hasFailed ? "Try Again" : "Export My Data";

  return (
    <>
      <Button
        onClick={handleExport}
        disabled={isExporting}
        variant="primary"
        className={`bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed ${className}`.trim()}
        aria-busy={isExporting || undefined}
        aria-describedby={isExporting ? "export-status" : undefined}
        isLoading={isExporting}
        leftIcon={!isExporting ? <Download className="w-4 h-4" aria-hidden="true" /> : undefined}
      >
        {buttonLabel}
      </Button>

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
