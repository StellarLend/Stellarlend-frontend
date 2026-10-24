"use client";

import { useEffect, useRef } from "react";

export interface TradSheetProps {
  /** Whether the sheet is currently open. */
  open: boolean;
  /** Called when the user dismisses the sheet (backdrop, close button, Escape). */
  onClose: () => void;
  /** Title shown in the sheet header, e.g. the market symbol. */
  title?: string;
  /** Subtitle shown under the title, e.g. the market name. */
  subtitle?: string;
  /** The trade panel content (amount input, actions, etc.). */
  children: React.ReactNode;
}

/**
 * Mobile bottom sheet for the trade panel.
 *
 * Renders a fixed backdrop plus a sheet anchored to the bottom of the
 * viewport. The sheet is capped at 85vh and scrolls internally so the
 * Confirm button remains reachable on landscape phones. Safe-area
 * padding keeps content clear of the home indicator.
 */
export default function TradeSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: TradSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    // Move focus into the sheet so keyboard users and screen readers
    // land in the right place. The existing accessibility issue handles
    // full focus trapping; this is just a safe initial focus.
    const timer = window.setTimeout(() => {
      sheetRef.current?.querySelector<HTMLElement>(
        'input, button, [tabindex]',
      )?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 sm:hidden"
      data-testid="trade-sheet-root"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-200 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
        data-testid="trade-sheet-backdrop"
      />
      {/* Sheet */}
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-sheet-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-800 bg-slate-950 shadow-xl transition-transform duration-200 motion-reduce:transition-none sheet-enter"
        data-testid="trade-sheet"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 id="trade-sheet-title" className="truncate text-base font-semibold text-slate-100">
                {title}
              </h2>
            ) : (
              <h2 id="trade-sheet-title" className="text-base font-semibold text-slate-100">
                Trade
              </h2>
            )}
            {subtitle ? (
              <p className="truncate text-xs text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trade panel"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            data-testid="trade-sheet-close"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              &times;
            </span>
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          {children}
        </div>
      </section>
    </div>
  );
}
