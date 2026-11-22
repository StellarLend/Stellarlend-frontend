"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

const TITLE_TEXT = "Application error";
const DESC_TEXT =
  "A critical system error occurred. Please try reloading the application.";
const RETRY_TEXT = "Try again";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, {
      boundary: "global-error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          backgroundColor: "#0a0a0a",
          color: "#ededed",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            margin: "24px",
            padding: "32px",
            borderRadius: "12px",
            backgroundColor: "#171717",
            border: "1px solid #262626",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            {"!"}
          </div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "600",
              margin: "0 0 8px",
            }}
          >
            {TITLE_TEXT}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#a3a3a3",
              margin: "0 0 24px",
              lineHeight: "1.5",
            }}
          >
            {DESC_TEXT}
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            {RETRY_TEXT}
          </button>
        </div>
      </body>
    </html>
  );
}
