"use client";

import { useEffect, useRef, useState } from "react";

interface AccountDeletionDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirmDelete: () => void;
}

export default function AccountDeletionDialog({
  isOpen,
  onCancel,
  onConfirmDelete,
}: AccountDeletionDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) setConfirmed(false);
  }, [isOpen]);

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
        onCancel();
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
            onClick={onConfirmDelete}
            disabled={!confirmed}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete My Account
          </button>
        </div>
      </div>
    </div>
  );
}
