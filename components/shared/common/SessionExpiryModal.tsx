"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SessionExpiryDialog from "./SessionExpiryDialog";

export interface SessionExpiryModalProps {
  /**
   * How many minutes before session expiry to surface the modal.
   * Defaults to 5 minutes.
   */
  warningMinutes?: number;

  /**
   * How often (in milliseconds) to re-poll the session endpoint while the
   * tab is visible. This is a safety net in case the SSE push (or any other
   * mechanism) is not available — it must never be the primary trigger.
   * Defaults to 60 seconds.
   */
  pollIntervalMs?: number;

  /**
   * Optional override for the session endpoint. Defaults to /api/auth/session.
   */
  sessionUrl?: string;

  /**
   * Optional override for the refresh endpoint. Defaults to /api/auth/refresh.
   */
  refreshUrl?: string;

  /**
   * Optional override for the logout endpoint. Defaults to /api/auth/logout.
   */
  logoutUrl?: string;

  /**
   * Where to send the user after a successful logout. Defaults to "/".
   */
  postLogoutRedirect?: string;

  /**
   * Skip rendering the modal entirely. Useful for tests / opt-out.
   */
  disabled?: boolean;
}

interface SessionPayload {
  session?: {
    active?: boolean;
    expiresAt?: string;
    issuedAt?: string;
  };
}

const DEFAULT_WARNING_MINUTES = 5;
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const ONE_MINUTE_MS = 60_000;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * SessionExpiryModal orchestrates the proactive warning UX for expiring
 * sessions. It is intentionally a self-contained client component so that
 * `app/layout.tsx` can mount a single instance for the entire app tree.
 *
 * Design notes:
 *  - We do NOT rely on a setInterval for the warning moment itself; we
 *    schedule a single setTimeout at `expiresAt - warningMs` and re-arm
 *    after each refresh / login. This avoids constantly hammering the
 *    session endpoint with background requests.
 *  - A defensive poll (default 60s) re-checks the expiry to recover from
 *    clock drift or background tab resumes.
 *  - Only ONE modal may be open at any time; a `modalOpenedRef` suppresses
 *    scheduling extra timeouts while the modal is already visible.
 *  - Timers and abort controllers are cleared on unmount to avoid leaks.
 */
export default function SessionExpiryModal({
  warningMinutes = DEFAULT_WARNING_MINUTES,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  sessionUrl = "/api/auth/session",
  refreshUrl = "/api/auth/refresh",
  logoutUrl = "/api/auth/logout",
  postLogoutRedirect = "/",
  disabled = false,
}: SessionExpiryModalProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<
    | { status: "idle" | "submitting" | "success" | "error"; message?: string }
  >({ status: "idle" });
  const [inFlight, setInFlight] = useState<
    null | "refresh" | "logout"
  >(null);

  // Tracks whether the modal is currently open so we don't schedule extra
  // timeouts or log loud warnings when we are already showing it.
  const modalOpenedRef = useRef(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastExpiresAtRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    modalOpenedRef.current = false;
  }, []);

  const scheduleWarning = useCallback(
    (expiresAtIso: string) => {
      // Don't pile up more timers if the modal is already visible.
      if (modalOpenedRef.current) {
        return;
      }

      const expiresAtMs = Date.parse(expiresAtIso);
      if (Number.isNaN(expiresAtMs)) {
        return;
      }

      const offsetMs = warningMinutes * ONE_MINUTE_MS;
      const delay = Math.max(0, expiresAtMs - Date.now() - offsetMs);

      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }

      warningTimerRef.current = setTimeout(() => {
        // Re-check at the boundary in case the session has already expired.
        modalOpenedRef.current = true;
        setOpen(true);
        setAnnouncement({
          status: "submitting",
          message: "Your session is about to expire.",
        });
      }, delay);

      lastExpiresAtRef.current = expiresAtIso;
    },
    [warningMinutes],
  );

  const handleSessionResponse = useCallback(
    async (response: Response) => {
      if (response.status === 401) {
        // Not authenticated; nothing to do. Make sure we tear down timers.
        clearTimers();
        modalOpenedRef.current = false;
        setOpen(false);
        return;
      }

      if (!response.ok) {
        // Treat transient errors as "try again later" — leave timers in place.
        return;
      }

      let payload: SessionPayload;
      try {
        payload = (await response.json()) as SessionPayload;
      } catch {
        return;
      }

      const expiresAt = payload.session?.expiresAt;
      if (!expiresAt) {
        return;
      }

      // If we have a modal open and the new expiry is still far in the
      // future, that means a refresh just landed — close the modal
      // automatically and re-arm the warning timer for the new window.
      if (modalOpenedRef.current) {
        const expiresAtMs = Date.parse(expiresAt);
        if (
          !Number.isNaN(expiresAtMs) &&
          expiresAtMs - Date.now() >
            warningMinutes * ONE_MINUTE_MS
        ) {
          closeModal();
        }
      }

      scheduleWarning(expiresAt);
    },
    [clearTimers, closeModal, scheduleWarning, warningMinutes],
  );

  const fetchSession = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(sessionUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      await handleSessionResponse(response);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }
      // Network errors: leave timers in place; the next poll will retry.
    }
  }, [handleSessionResponse, sessionUrl]);

  // Initial fetch + periodic safety-net poll.
  useEffect(() => {
    if (disabled) return undefined;

    void fetchSession();

    pollTimerRef.current = setInterval(() => {
      void fetchSession();
    }, pollIntervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimers();
      modalOpenedRef.current = false;
    };
  }, [clearTimers, disabled, fetchSession, pollIntervalMs]);

  const postWithCsrf = useCallback(
    async (url: string) => {
      const csrf = readCookie("csrf-token");
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (csrf) {
        headers["x-csrf-token"] = csrf;
      }

      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers,
      });
      return response;
    },
    [],
  );

  const handleStayLoggedIn = useCallback(async () => {
    if (inFlight) return;
    setInFlight("refresh");
    setAnnouncement({
      status: "submitting",
      message: "Refreshing your session…",
    });

    try {
      const response = await postWithCsrf(refreshUrl);
      if (response.ok) {
        setAnnouncement({
          status: "success",
          message: "Session refreshed. You can keep working.",
        });
        // Refresh the timers + close modal if the new expiry is far enough.
        await fetchSession();
        setInFlight(null);
      } else {
        setAnnouncement({
          status: "error",
          message:
            "Could not refresh your session. Please sign in again.",
        });
        setInFlight(null);
      }
    } catch (error) {
      setAnnouncement({
        status: "error",
        message:
          "Network error while refreshing your session. Please try again.",
      });
      setInFlight(null);
    }
  }, [fetchSession, inFlight, postWithCsrf, refreshUrl]);

  const handleLogOut = useCallback(async () => {
    if (inFlight) return;
    setInFlight("logout");
    setAnnouncement({ status: "submitting", message: "Signing you out…" });

    try {
      const response = await postWithCsrf(logoutUrl);
      if (response.ok || response.status === 401) {
        setAnnouncement({
          status: "success",
          message: "You have been signed out.",
        });
        clearTimers();
        closeModal();
        setInFlight(null);
        // Send the user back to the entry page after sign out.
        if (typeof window !== "undefined") {
          window.location.assign(postLogoutRedirect);
        } else {
          router.replace(postLogoutRedirect);
        }
        return;
      }
      setAnnouncement({
        status: "error",
        message: "Could not sign you out. Please try again.",
      });
      setInFlight(null);
    } catch (error) {
      setAnnouncement({
        status: "error",
        message: "Network error while signing you out.",
      });
      setInFlight(null);
    }
  }, [
    clearTimers,
    closeModal,
    inFlight,
    logoutUrl,
    postLogoutRedirect,
    postWithCsrf,
    router,
  ]);

  if (disabled || !open) {
    return <SessionAnnouncer announcement={announcement.message ?? ""} />;
  }

  return (
    <>
      <SessionExpiryDialog
        isOpen={open}
        onStayLoggedIn={handleStayLoggedIn}
        onLogOut={handleLogOut}
      />
      <SessionAnnouncer announcement={announcement.message ?? ""} />
    </>
  );
}

/**
 * Inline aria-live region used to announce session-expiry state changes
 * to assistive tech. Kept inline (rather than reusing StatusAnnouncer) to
 * avoid forcing a misleading "repay/lend/borrow" verb into a session
 * context — StatusAnnouncer's shape is purposefully tied to the loan
 * pipeline.
 */
function SessionAnnouncer({ announcement }: { announcement: string }) {
  if (!announcement) return null;
  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="session-announcer"
    >
      {announcement}
    </div>
  );
}
