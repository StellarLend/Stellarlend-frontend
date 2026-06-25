"use client";

import { useState } from "react";
import Button from "@/components/shared/ui/Button";
import Toast, { type ToastVariant } from "@/components/shared/common/Toast";

type ExportResponse = {
  success?: boolean;
  message?: string;
  downloadUrl?: string;
  expiresInSeconds?: number;
  error?: string;
};

type ToastState = {
  title: string;
  description: string;
  variant: ToastVariant;
};

export interface DataExportButtonProps {
  endpoint?: string;
  onDownload?: (downloadUrl: string) => void;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function buildExportRequest(): RequestInit {
  const csrfToken = readCookie("csrf-token");

  if (!csrfToken) {
    return { method: "POST" };
  }

  return {
    method: "POST",
    headers: {
      "x-csrf-token": csrfToken,
    },
  };
}

function downloadSignedBundle(downloadUrl: string) {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = "stellarlend-account-export.zip";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function parseExportResponse(response: Response): Promise<ExportResponse> {
  try {
    return (await response.json()) as ExportResponse;
  } catch {
    return {};
  }
}

export default function DataExportButton({
  endpoint = "/api/account/export",
  onDownload = downloadSignedBundle,
}: DataExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    setToast({
      title: "Preparing data export",
      description: "Compiling your account archive and signed download.",
      variant: "processing",
    });

    try {
      const response = await fetch(endpoint, buildExportRequest());
      const payload = await parseExportResponse(response);

      if (!response.ok) {
        throw new Error(payload.error || "The export request could not be completed.");
      }

      if (!payload.downloadUrl) {
        throw new Error("The export response did not include a signed download URL.");
      }

      onDownload(payload.downloadUrl);
      setToast({
        title: "Data export ready",
        description: payload.expiresInSeconds
          ? `Your signed download link is valid for ${Math.round(payload.expiresInSeconds / 60)} minutes.`
          : "Your signed account export is ready to download.",
        variant: "success",
      });
    } catch (error) {
      setToast({
        title: "Export failed",
        description:
          error instanceof Error
            ? error.message
            : "Your account export could not be generated. See docs/dsar-export-runbook.md for operations guidance.",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Account data export</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate a signed GDPR/DSAR archive for your profile, preferences, transactions,
            and notifications.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          isLoading={isExporting}
          aria-busy={isExporting}
          aria-describedby="data-export-status"
          className="shrink-0"
        >
          {isExporting ? "Exporting data" : "Export my data"}
        </Button>
      </div>

      <p id="data-export-status" className="mt-3 text-xs text-gray-500" aria-live="polite">
        Exports are rate-limited to one request per account every 24 hours. Signed links expire
        after 15 minutes.
      </p>

      {toast && (
        <Toast
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
        />
      )}
    </div>
  );
}
