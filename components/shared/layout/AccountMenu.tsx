"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useWallet } from "@/hooks/useWallet";
import { copyToClipboard } from "@/lib/utils/clipboard";
import Link from "next/link";
import { Copy, Check, Settings, LogOut, ChevronDown } from "lucide-react";

const focusClasses =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-green-600";

function getShortAddress(addr: string) {
  return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
}

export const AccountMenu = () => {
  const { address, status, error, connect, disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const loading = status === "connecting";

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setCopySuccess(false);
    setCopyError(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeMenu]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        closeMenu();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, closeMenu]);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    setCopyError(null);
    const result = await copyToClipboard(address, true);
    if (result.success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500);
    } else {
      setCopyError(
        result.reason === "invalid_address"
          ? "Invalid address"
          : "Copy failed",
      );
    }
  }, [address]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    closeMenu();
  }, [disconnect, closeMenu]);

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      setCopySuccess(false);
      setCopyError(null);
    }
    setIsOpen((prev) => !prev);
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown" && !isOpen) {
        event.preventDefault();
        setIsOpen(true);
        setTimeout(() => {
          const firstItem = menuRef.current?.querySelector(
            "[role='menuitem']",
          ) as HTMLElement | null;
          firstItem?.focus();
        }, 0);
      }
    },
    [isOpen],
  );

  return (
    <div className="relative flex items-center">
      {address ? (
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            aria-label="Account menu"
            aria-expanded={isOpen}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            className={`flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-between border py-2 px-4 w-[139px] rounded-full ${focusClasses}`}
          >
            <span>{getShortAddress(address)}</span>
            <ChevronDown
              className={`w-3 h-3 text-white transition-transform ${isOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {isOpen && (
            <div
              ref={menuRef}
              role="menu"
              aria-label="Account options"
              className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
            >
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 break-all font-mono">
                  {address}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleCopy}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100"
              >
                {copySuccess ? (
                  <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{copySuccess ? "Copied" : "Copy Address"}</span>
                {copyError && (
                  <span className="ml-auto text-xs text-red-500">{copyError}</span>
                )}
              </button>
              <Link
                href="/account/profile"
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100"
                onClick={closeMenu}
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                <span>Account Settings</span>
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleDisconnect}
                disabled={loading}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Connect wallet"
          onClick={connect}
          disabled={loading}
          className={`flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-center border py-2 px-4 w-[139px] rounded-full ${focusClasses} ${loading ? "opacity-80" : ""}`}
        >
          <span>{loading ? "Connecting..." : "Connect Wallet"}</span>
        </button>
      )}
      {error && (
        <span
          data-testid="wallet-error"
          className="text-xs text-red-200 absolute -bottom-5 right-0 whitespace-nowrap bg-red-800/80 px-2 py-0.5 rounded"
        >
          {error}
        </span>
      )}
    </div>
  );
};

export default AccountMenu;
