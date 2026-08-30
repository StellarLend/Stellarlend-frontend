import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { validateServerProtectedSession } from "@/lib/auth/session-boundary";
import {
  PROTECTED_ROUTE_BOUNDS,
  recordAuthorizationEvent,
  sanitizeReturnTo,
  type AuthorizationDenialReason,
} from "@/lib/auth/protected-route-telemetry";

interface ProtectedRouteLayoutProps {
  children: ReactNode;
  returnTo?: string;
}

/**
 * Server component that guards a subtree behind an authenticated session.
 *
 * Invariants enforced:
 *  1. Children are **never** rendered when the session is absent, expired,
 *     structurally invalid, or when getSession exceeds the validation
 *     timeout.
 *  2. The `returnTo` parameter is sanitised against length and prefix
 *     bounds to prevent open-redirect abuse.
 *  3. Every authorization decision (granted / denied) is recorded as a
 *     structured telemetry event with latency, denial reason, and whether
 *     returnTo was sanitised — no wallet addresses or session tokens are
 *     logged.
 *  4. Redundant renders are impossible: this is a React Server Component
 *     that executes exactly once per request on the server. There is no
 *     client-side state, no polling, and no re-fetch.
 */
export default async function ProtectedRouteLayout({
  children,
  returnTo = "/dashboard/settings",
}: ProtectedRouteLayoutProps) {
  const startTime = performance.now();

  // --- Invariant 2: Sanitize returnTo against bounds ---
  const { value: safeReturnTo, sanitized } = sanitizeReturnTo(returnTo, "/dashboard/settings");

  // --- Invariant 1: Validate session before any rendering ---
  let authorizationDenialReason: AuthorizationDenialReason | undefined;
  let sessionExpired = false;

  try {
    const session = await getSession();

    if (session === null) {
      authorizationDenialReason = "missing-session";
    } else {
      try {
        validateServerProtectedSession(session);
      } catch (err) {
        // Map the SessionBoundaryError reason to our denial reason type
        const reason = (err as { reason?: string }).reason as
          | AuthorizationDenialReason
          | undefined;
        authorizationDenialReason = reason ?? "session-error";
        if (reason === "expired-session") {
          sessionExpired = true;
        }
      }
    }
  } catch {
    // getSession itself threw (e.g. cookie parse error)
    authorizationDenialReason = "session-error";
  }

  const latencyMs = performance.now() - startTime;

  if (authorizationDenialReason) {
    // --- Invariant 3: Record telemetry (no secrets) ---
    recordAuthorizationEvent({
      outcome: "denied",
      latencyMs,
      targetRoute: safeReturnTo,
      denialReason: authorizationDenialReason,
      sessionExpired,
      returnToSanitized: sanitized,
    });

    redirect(`/?returnUrl=${encodeURIComponent(safeReturnTo)}`);
  }

  // Authorization granted
  recordAuthorizationEvent({
    outcome: "granted",
    latencyMs,
    targetRoute: safeReturnTo,
    returnToSanitized: sanitized,
  });

  // --- Invariant 1: Only render children when session is valid ---
  return <>{children}</>;
}
