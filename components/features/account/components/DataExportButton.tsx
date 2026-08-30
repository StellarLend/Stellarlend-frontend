"use client";

import React, { useState } from "react";
import { Download } from "lucide-react";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/shared/common/Toast";

interface DataExportButtonProps {
  className?: string;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export default function DataExportButton({ className = "" }: DataExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const { showToast } = useToast();

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    setHasFailed(false);
    showToast({ variant: "processing", title: "Preparing your data export...", description: "This may take a moment." });

    const csrfToken = readCookie("csrf-token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    try {
      const response = await fetch("/api/account/export", {
        method: "POST",
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          showToast({
            variant: "error",
            title: "Export rate limit exceeded",
            description: data.error || "Please wait 24 hours before requesting another export."
          });
        } else {
          showToast({
            variant: "error",
            title: "Export failed",
            description: data.error || "An error occurred while preparing your export."
          });
        }
        setHasFailed(true);
        return;
      }

      if (data.downloadUrl) {
        // Fetch the file contents from the signed download link as a blob
        const fileResponse = await fetch(data.downloadUrl);
        if (!fileResponse.ok) {
          throw new Error("Failed to download the data export archive file.");
        }
        const blob = await fileResponse.blob();
        const downloadUrlObj = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = downloadUrlObj;
        link.download = `stellarlend-export-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrlObj);

        showToast({
          variant: "success",
          title: "Export ready",
          description: "Your data export has been downloaded successfully."
        });
      } else {
        setHasFailed(true);
        showToast({
          variant: "error",
          title: "Export incomplete",
          description: "No download URL received. Please try again."
        });
      }
    } catch (error) {
      setHasFailed(true);
      showToast({
        variant: "error",
        title: "Export failed",
        description: "Network error occurred. Please check your connection and try again."
      });
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
    </>
  );
}
