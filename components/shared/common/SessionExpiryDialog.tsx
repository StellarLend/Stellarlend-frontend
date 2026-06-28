"use client";

import { useEffect, useRef } from "react";

interface SessionExpiryDialogProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogOut: () => void;
}

export default function SessionExpiryDialog({
  isOpen,
  onStayLoggedIn,
  onLogOut,
}: SessionExpiryDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    stayButtonRef.current?.focus();

    const focusableSelector = [
      "button:not([disabled])",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onLogOut();
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
  }, [isOpen, onLogOut]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="session-expiry-title" className="text-lg font-semibold text-gray-900">
          Session Expiring Soon
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Your session is about to expire. Do you want to stay logged in?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onLogOut}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Log Out
          </button>
          <button
            ref={stayButtonRef}
            type="button"
            onClick={onStayLoggedIn}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
