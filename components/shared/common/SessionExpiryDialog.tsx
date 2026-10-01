"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

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

  useFocusTrap(dialogRef, { isActive: isOpen, onEscape: onLogOut });

  useEffect(() => {
    if (!isOpen) return;

    stayButtonRef.current?.focus();
  }, [isOpen]);

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
        <h2
          id="session-expiry-title"
          className="text-lg font-semibold text-gray-900"
        >
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
