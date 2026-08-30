"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/common/Toast";

const CONFIRMATION_PHRASE = "DELETE";

export default function AccountDeletionPanel() {
  const router = useRouter();
  const { showToast } = useToast();

  const [isFetching, setIsFetching] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const phraseMatches = typedPhrase === CONFIRMATION_PHRASE;

  const handleCancelDialog = useCallback(() => {
    setIsDialogOpen(false);
    setTypedPhrase("");
    setChallenge(null);
  }, []);

  useEffect(() => {
    if (!isDialogOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancelDialog();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled])",
        ) ?? [],
      );
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [isDialogOpen, handleCancelDialog]);

  const handleInitiate = async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const res = await fetch("/api/account/delete/challenge");
      const data = await res.json();
      if (!res.ok) {
        const description =
          res.status === 429
            ? "Too many requests. Please try again later."
            : data?.error?.message || "Could not start deletion. Please try again.";
        showToast({
          variant: "error",
          title: res.status === 429 ? "Rate limit exceeded" : "Challenge failed",
          description,
        });
        return;
      }
      setChallenge(data.challenge);
      setIsDialogOpen(true);
    } catch {
      showToast({
        variant: "error",
        title: "Network error",
        description: "Could not reach the server. Check your connection.",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleConfirm = async () => {
    if (!challenge || !phraseMatches || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({
          variant: "error",
          title: "Deletion failed",
          description: data.error || "Account deletion failed. Please try again.",
        });
        setIsDeleting(false);
        return;
      }
      setIsDialogOpen(false);
      router.push("/");
    } catch {
      showToast({
        variant: "error",
        title: "Network error",
        description: "Could not reach the server. Check your connection.",
      });
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-red-700 mb-2">
        Delete Account
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Permanently delete your account and all associated data. This action is
        irreversible and cannot be undone.
      </p>
      <button
        onClick={handleInitiate}
        disabled={isFetching}
        aria-busy={isFetching}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isFetching ? "Requesting..." : "Delete My Account"}
      </button>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deletion-panel-title"
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2
              id="deletion-panel-title"
              className="text-lg font-semibold text-red-700"
            >
              Delete Account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This action is permanent and cannot be undone. Type{" "}
              <strong className="text-red-700">{CONFIRMATION_PHRASE}</strong>{" "}
              below to confirm.
            </p>
            <input
              ref={inputRef}
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={`Type "${CONFIRMATION_PHRASE}" to confirm`}
              disabled={isDeleting}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              aria-label={`Type ${CONFIRMATION_PHRASE} to confirm deletion`}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDialog}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!phraseMatches || isDeleting}
                aria-busy={isDeleting || undefined}
                data-testid="confirm-delete-button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
