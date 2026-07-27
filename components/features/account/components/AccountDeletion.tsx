"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountDeletionDialog from "@/components/shared/common/AccountDeletionDialog";
import { useToast } from "@/components/shared/common/Toast";

/**
 * Map known server error codes to fixed, reviewed user-facing messages.
 * Any unrecognised code falls through to `null` so callers use a
 * generic fallback instead of echoing raw server strings to the user.
 */
function mapChallengeError(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  const code = typeof d.code === "string" ? d.code : null;
  const status = typeof d.status === "number" ? d.status : null;

  const messages: Record<string, string> = {
    CHALLENGE_EXPIRED: "Your deletion request has expired. Please try again.",
    CHALLENGE_RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
    ACCOUNT_NOT_FOUND: "Account not found. It may have already been deleted.",
    UNAUTHORIZED: "You are not authorised to perform this action. Please sign in again.",
  };

  if (code && messages[code]) return messages[code];

  // Fall back to HTTP status for well-known codes
  if (status === 429) return "Too many requests. Please try again later.";
  if (status === 401) return "Your session has expired. Please sign in again.";

  return null;
}

export default function AccountDeletion() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const { showToast } = useToast();

  const handleInitiate = async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const res = await fetch("/api/account/delete/challenge");
      const data = await res.json();
      if (!res.ok) {
        const mapped = mapChallengeError(data);
        if (res.status === 429) {
          showToast({
            variant: "error",
            title: "Rate limit exceeded",
            description: mapped ?? "Too many requests. Please try again later.",
          });
        } else {
          showToast({
            variant: "error",
            title: "Challenge failed",
            description: mapped ?? "Could not start deletion. Please try again.",
          });
        }
        return;
      }
      setChallenge(data.challenge);
      setDialogOpen(true);
    } catch {
      showToast({ variant: "error", title: "Network error", description: "Could not reach the server. Check your connection." });
    } finally {
      setFetching(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!challenge) throw new Error("No deletion challenge available.");
    const res = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Account deletion failed. Please try again.");
    }
    setDialogOpen(false);
    router.push("/");
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setChallenge(null);
  };

  return (
    <>
      <div>
        <h3 className="text-lg font-semibold text-red-700 mb-2">Delete Account</h3>
        <p className="text-sm text-gray-600 mb-4">
          Permanently delete your account and all associated data. This action is
          irreversible and cannot be undone.
        </p>
        <button
          onClick={handleInitiate}
          disabled={fetching}
          aria-busy={fetching}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {fetching ? "Requesting..." : "Delete My Account"}
        </button>
      </div>

      <AccountDeletionDialog
        isOpen={dialogOpen}
        onCancel={handleCancel}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  );
}
