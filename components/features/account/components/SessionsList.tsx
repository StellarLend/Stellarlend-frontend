"use client";

/**
 * SessionsList
 *
 * Surfaces the signed-in user's active sessions and lets them revoke any one
 * of them. Data is read from `GET /api/account/sessions` and a session is
 * revoked via `DELETE /api/account/sessions/[id]`.
 *
 * The component owns its own loading / empty / error states and guards the
 * current session behind an explicit confirmation that spells out the
 * consequence of self-revoking (being signed out of this device).
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface SessionDevice {
  userAgent: string | null;
  ipAddress: string | null;
}

export interface AccountSession {
  id: string;
  current: boolean;
  device: SessionDevice;
  createdAt: string | number;
  lastSeenAt: string | number;
}

type LoadStatus = "loading" | "ready" | "error";

/**
 * Best-effort, dependency-free conversion of a User-Agent string into a short
 * human label. Kept intentionally small — the goal is a recognisable hint, not
 * a full UA parser.
 */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const ua = userAgent.toLowerCase();

  const os =
    ua.includes("windows")
      ? "Windows"
      : ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")
        ? "iOS"
        : ua.includes("mac")
          ? "macOS"
          : ua.includes("android")
            ? "Android"
            : ua.includes("linux")
              ? "Linux"
              : null;

  const browser =
    ua.includes("edg")
      ? "Edge"
      : ua.includes("chrome")
        ? "Chrome"
        : ua.includes("firefox")
          ? "Firefox"
          : ua.includes("safari")
            ? "Safari"
            : null;

  if (os && browser) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}

/** Format an ISO/epoch timestamp into a short, locale-stable label. */
export function formatLastActive(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

interface RevokeConfirmModalProps {
  session: AccountSession;
  isRevoking: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Focused confirmation dialog for revoking a single session. The lending
 * `ConfirmModal` is purpose-built around transaction data, so this lightweight
 * dialog mirrors its accessibility contract (role="dialog", aria-modal,
 * labelled title) without the unrelated coupling.
 */
function RevokeConfirmModal({
  session,
  isRevoking,
  error,
  onConfirm,
  onCancel,
}: RevokeConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-gray-500/75"
        onClick={isRevoking ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revoke-session-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3
          id="revoke-session-title"
          className="text-lg font-semibold text-gray-900"
        >
          Revoke this session?
        </h3>

        <p className="mt-2 text-sm text-gray-600">
          {describeDevice(session.device.userAgent)}
          {session.device.ipAddress ? ` · ${session.device.ipAddress}` : ""} will
          be signed out immediately.
        </p>

        {session.current && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
          >
            <strong className="font-semibold">
              This is your current session.
            </strong>{" "}
            Revoking it will sign you out of this device and you will need to log
            in again.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRevoking}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isRevoking}
            aria-busy={isRevoking}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRevoking ? "Revoking…" : "Revoke session"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SessionsList() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [target, setTarget] = useState<AccountSession | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/account/sessions");
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleConfirmRevoke = useCallback(async () => {
    if (!target) return;

    setIsRevoking(true);
    setRevokeError(null);
    try {
      const query = target.current ? "?confirm=true" : "";
      const res = await fetch(
        `/api/account/sessions/${encodeURIComponent(target.id)}${query}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        setRevokeError("Could not revoke the session. Please try again.");
        return;
      }

      setSessions((prev) => prev.filter((item) => item.id !== target.id));
      setTarget(null);
    } catch {
      setRevokeError("Could not revoke the session. Please try again.");
    } finally {
      setIsRevoking(false);
    }
  }, [target]);

  const closeModal = useCallback(() => {
    if (isRevoking) return;
    setTarget(null);
    setRevokeError(null);
  }, [isRevoking]);

  if (status === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading active sessions"
        className="space-y-3"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-light h-20 w-full rounded-lg"
            data-testid="session-skeleton"
          />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        <p className="font-medium">We couldn&apos;t load your active sessions.</p>
        <button
          type="button"
          onClick={loadSessions}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        You have no other active sessions.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-3" aria-label="Active sessions">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">
                  {describeDevice(session.device.userAgent)}
                </p>
                {session.current && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {session.device.ipAddress ?? "Unknown IP"} · Last active{" "}
                {formatLastActive(session.lastSeenAt)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setRevokeError(null);
                setTarget(session);
              }}
              className={cn(
                "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "bg-red-50 text-red-700 hover:bg-red-100",
              )}
              aria-label={`Revoke ${describeDevice(session.device.userAgent)}${
                session.current ? " (current session)" : ""
              }`}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>

      {target && (
        <RevokeConfirmModal
          session={target}
          isRevoking={isRevoking}
          error={revokeError}
          onConfirm={handleConfirmRevoke}
          onCancel={closeModal}
        />
      )}
    </>
  );
}
