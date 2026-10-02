import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { WalletProvider } from "@/context/WalletContext";
import NextTopLoader from "nextjs-toploader";
import { headers } from "next/headers";
import { ToastProvider } from "@/components/shared/common/Toast";
import NotificationToastBridge from "@/components/shared/common/NotificationToastBridge";
import { logger } from "@/lib/logger";

export const metadata: Metadata = {
  title: "StellarLend",
  description: "Decentralized lending and borrowing on Stellar",
};

/**
 * RFC 4648 / W3C Content Security Policy Level 3 compliant nonce format:
 * Cryptographic nonces must contain only base64 or base64url characters
 * (alphanumeric, +, /, =, -, _), bounded between 16 and 128 characters.
 *
 * Invariant: Any input containing whitespace, quotes, newlines, HTML tags,
 * commas, semicolons, or invalid length is strictly rejected to prevent
 * Cross-Site Scripting (XSS), script breakout, and header injection.
 */
export const CSP_NONCE_REGEX = /^[A-Za-z0-9+/=_-]{16,128}$/;

/**
 * Validates whether a candidate nonce adheres strictly to CSP security standards.
 *
 * Rejection criteria:
 * - Non-string types (null, undefined, numbers, objects)
 * - Empty or whitespace-only strings
 * - Strings with leading, trailing, or embedded whitespace
 * - Disallowed characters (e.g. quotes, commas, angle brackets, control chars)
 * - Out-of-bounds lengths (< 16 or > 128 chars)
 */
export function isValidCspNonce(nonce: unknown): nonce is string {
  if (typeof nonce !== "string") {
    return false;
  }
  if (nonce.length < 16 || nonce.length > 128) {
    return false;
  }
  if (nonce.trim() !== nonce) {
    return false;
  }
  return CSP_NONCE_REGEX.test(nonce);
}

/**
 * Safely serializes the nonce assignment for inline script execution.
 *
 * Invariant: Even for a validated nonce, JSON stringification and HTML angle bracket
 * escaping (\u003c) guarantee that the payload can NEVER terminate the enclosing
 * <script> element (preventing </script> breakouts).
 */
export function serializeCspNonceScript(nonce: string): string {
  const safeJson = JSON.stringify(nonce).replace(/</g, "\\u003c");
  return `window.CSP_NONCE = ${safeJson};`;
}

/**
 * Resolves the CSP nonce from request headers safely with defensive error handling.
 *
 * Failure paths & boundaries handled:
 * - Missing or undefined header list -> returns undefined
 * - headers() rejection or throw (e.g. outside request context, static generation) -> caught gracefully, returns undefined
 * - Missing or empty "x-csp-nonce" header -> returns undefined
 * - Malformed, oversized, hostile, or duplicate headers -> rejected with safe diagnostic log (without leaking sensitive data)
 * - Valid nonce -> returns validated nonce string
 */
export async function resolveSafeNonce(): Promise<string | undefined> {
  try {
    const headerList = await headers();
    if (!headerList || typeof headerList.get !== "function") {
      return undefined;
    }

    const rawNonce = headerList.get("x-csp-nonce");
    if (!rawNonce) {
      return undefined;
    }

    if (!isValidCspNonce(rawNonce)) {
      try {
        logger.warn(
          "Rejected malformed or invalid x-csp-nonce header",
          "RootLayout",
          {
            nonceLength: rawNonce.length,
            reason: "regex_mismatch_or_invalid_length",
          }
        );
      } catch {
        // Defensive: logging failure must never compromise layout execution
      }
      return undefined;
    }

    return rawNonce;
  } catch (error) {
    // Graceful degradation: in static export, SSR edge cases, or partial header failure,
    // layout continues rendering deterministically without crashing.
    try {
      logger.warn(
        "Failed to retrieve request headers in RootLayout; degrading gracefully",
        "RootLayout",
        {
          error: error instanceof Error ? error.message : "Unknown error",
        }
      );
    } catch {
      // Defensive: logging failure must never compromise layout execution
    }
    return undefined;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Retrieve CSP nonce deterministically with failure recovery and boundary validation
  const nonce = await resolveSafeNonce();

  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        {/*
         * Strict referrer policy: browsers will only send the origin (no path/query)
         * when navigating cross-origin, and the full URL for same-origin requests.
         * This prevents sensitive URL parameters from leaking to third parties.
         */}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className="antialiased">
        {/* Top progress bar */}
        <NextTopLoader
          color="#15a350"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #15a350, 0 0 5px #15a350"
          zIndex={9999}
        />
        {/* Inline script that exposes the CSP nonce for client-side use.
             referrerPolicy is set on this element as belt-and-suspenders even
             though <script> elements without src do not generate HTTP requests. */}
        {nonce && (
          <script
            nonce={nonce}
            referrerPolicy="strict-origin-when-cross-origin"
            dangerouslySetInnerHTML={{
              __html: serializeCspNonceScript(nonce),
            }}
          />
        )}
        <ToastProvider>
          <NotificationToastBridge />
          <WalletProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
