"use client";

import { useEffect, useRef, useState } from "react";
import AccountDeletionUndo from "@/components/features/account/components/AccountDeletionUndo";

type Phase = "form" | "countdown" | "deleting" | "error";

interface AccountDeletionDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirmDelete: () => void | Promise<void>;
}

export default function AccountDeletionDialog({
  isOpen,
  onCancel,
  onConfirmDelete,
}: AccountDeletionDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const phaseRef = useRef<Phase>("form");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (isOpen) {
      setConfirmed(false);
      setPhase("form");
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Refocus cancel button when returning to form from the countdown phase.
  const prevPhaseRef = useRef<Phase>("form");
  useEffect(() => {
    if (prevPhaseRef.current === "countdown" && phase === "form") {
      cancelButtonRef.current?.focus();
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // Captures previous focus, moves focus into dialog, traps Tab, and
  // restores focus on close. Kept as a single effect (matching the original)
  // so that the previouslyFocused save always precedes the focus move.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    cancelButtonRef.current?.focus();

    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (phaseRef.current === "countdown") {
          setPhase("form");
        } else {
          onCancel();
        }
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
      );
      if (!focusable.length) { e.preventDefault(); return; }

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
  }, [isOpen, onCancel]);

  const handleElapsed = async () => {
    setPhase("deleting");
    try {
      await onConfirmDelete();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Account deletion failed. Please try again."
      );
      setPhase("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-deletion-title"
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="account-deletion-title" className="text-lg font-semibold text-red-700">
          Delete Account
        </h2>

        {phase === "form" && (
          <>
            <p className="mt-2 text-sm text-gray-600">
              This action is permanent and cannot be undone. All your data will be deleted.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4"
              />
              I understand this action is irreversible
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setPhase("countdown")}
                disabled={!confirmed}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete My Account
              </button>
            </div>
          </>
        )}

        {phase === "countdown" && (
          <div className="mt-4">
            <AccountDeletionUndo
              onUndo={() => setPhase("form")}
              onElapsed={handleElapsed}
            />
          </div>
        )}

        {phase === "deleting" && (
          <p className="mt-4 text-sm text-gray-600">Deleting your account…</p>
        )}

        {phase === "error" && (
          <>
            <p className="mt-4 text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
