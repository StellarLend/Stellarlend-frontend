"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SUPPORTED_WALLETS, WalletAdapterEntry } from "@/lib/wallets";

interface WalletPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (walletId: string) => Promise<void>;
  lastWalletId?: string | null;
}

interface WalletItemStatus {
  entry: WalletAdapterEntry;
  isAvailable: boolean;
}

export function WalletPickerModal({
  isOpen,
  onClose,
  onSelectWallet,
  lastWalletId,
}: WalletPickerModalProps) {
  const t = useTranslations("wallet");
  const [wallets, setWallets] = useState<WalletItemStatus[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      let isMounted = true;
      setErrorMessage(null);

      Promise.all(
        SUPPORTED_WALLETS.map(async (entry) => {
          try {
            const adapter = await entry.loadAdapter();
            const available = await adapter.isAvailable();
            return { entry, isAvailable: available };
          } catch {
            return { entry, isAvailable: false };
          }
        })
      ).then((statuses) => {
        if (isMounted) {
          setWallets(statuses);
        }
      });

      return () => {
        isMounted = false;
      };
    } else {
      if (triggerRef.current && typeof triggerRef.current.focus === "function") {
        triggerRef.current.focus();
      }
    }
  }, [isOpen]);

  // Focus trap & escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = async (entry: WalletAdapterEntry, isAvailable: boolean) => {
    if (!isAvailable) return;
    setLoadingId(entry.id);
    setErrorMessage(null);
    try {
      await onSelectWallet(entry.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet";
      setErrorMessage(msg);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-picker-title"
      ref={modalRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <h2 id="wallet-picker-title" className="text-lg font-semibold text-white">
            {t("connectWallet")}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-violet-500"
            aria-label={t("close")}
          >
            <svg
              className="w-5 h-5"
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

        {errorMessage && (
          <div
            role="alert"
            className="mt-3 p-3 text-sm rounded-lg bg-red-950/60 border border-red-800 text-red-200"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
          {wallets.length === 0 ? (
            <div className="py-6 text-center text-sm text-zinc-500">
              {t("loadingWallets")}
            </div>
          ) : (
            wallets.map(({ entry, isAvailable }) => {
              const isRecent = lastWalletId === entry.id;
              const isLoading = loadingId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
                >
                  <button
                    disabled={!isAvailable || isLoading}
                    onClick={() => handleSelect(entry, isAvailable)}
                    className="flex items-center space-x-3 flex-1 text-left disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 focus:ring-violet-500 rounded-lg p-1"
                  >
                    <img
                      src={entry.icon}
                      alt={`${entry.name} icon`}
                      className="w-8 h-8 rounded-lg shrink-0"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-white">{entry.name}</span>
                        {isRecent && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/60 text-violet-300 border border-violet-700/50">
                            {t("recent")}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        {isLoading
                          ? t("connecting")
                          : isAvailable
                          ? t("available")
                          : t("notInstalled")}
                      </span>
                    </div>
                  </button>

                  {!isAvailable && entry.installUrl && (
                    <a
                      href={entry.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-300 font-medium px-2.5 py-1 rounded-md bg-violet-950/40 hover:bg-violet-900/40 border border-violet-800/50 transition-colors ml-2"
                    >
                      {t("install")}
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
