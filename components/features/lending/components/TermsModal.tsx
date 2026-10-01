"use client";

import { useEffect, useRef } from "react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();

    const focusableSelector = [
      "button:not([disabled])",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));

      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    // Capture phase so this modal's Escape handling runs, and is stopped,
    // before the underlying ConfirmModal's own document-level Escape
    // listener (attached in bubble phase) can see the event and close too.
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div
          ref={dialogRef}
          className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-modal-title"
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              id="terms-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              Terms and Conditions
            </h3>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
              aria-label="Close terms and conditions"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-3 text-sm text-gray-700 max-h-[60vh] overflow-y-auto">
            <p>
              By using StellarLend&apos;s lending, borrowing, repayment, and
              withdrawal features, you acknowledge and agree to the following:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                All transactions are executed on the Stellar blockchain and are
                irreversible once confirmed.
              </li>
              <li>
                Borrowing positions are secured by collateral, which may be
                liquidated if your health factor falls below the required
                threshold.
              </li>
              <li>
                Interest rates, health factors, and other figures shown before
                confirming are estimates and may change before your
                transaction settles on-chain.
              </li>
              <li>
                You are solely responsible for safeguarding your wallet and
                verifying transaction details before confirming.
              </li>
              <li>
                StellarLend provides this interface as-is, without warranty of
                any kind, and is not responsible for losses resulting from
                market volatility, network conditions, or user error.
              </li>
            </ul>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-white bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
