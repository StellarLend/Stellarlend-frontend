import React, { useState } from "react";
import { useWalletContext } from "@/context/WalletContext";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { navClasses } from "@/constants/design-tokens";

// Focus ring styling consistent with ICON_BUTTON_ACCESSIBILITY.md
const focusClasses = `${navClasses.iconButtonFocusClasses} focus-visible:ring-offset-black`;

/** Truncate a Stellar address for display, e.g. GABCD...WXYZ */
const truncateAddress = (addr: string) => `${addr.slice(0, 5)}…${addr.slice(-4)}`;

/**
 * WalletConnectButton – handles connecting, disconnecting, displaying the address,
 * copying to clipboard, and showing any connection errors.
 */
const WalletConnectButton: React.FC = () => {
  const { address, status, error, connect, disconnect } = useWalletContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const loading = status === "connecting";

  const handleCopy = async () => {
    if (!address) return;
    await copyToClipboard(address);
  };

  return (
    <div className="flex items-center gap-3 relative">
      {address ? (
        <div className="relative">
          <button
            type="button"
            aria-label="Connected wallet"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-2 text-white bg-gray-900 border border-gray-700 py-2 px-4 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors ${focusClasses}`}
          >
            <span>{truncateAddress(address)}</span>
            <svg
              className="w-3 h-3 text-white transition-transform"
              viewBox="0 0 10 6"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z"
                fill="currentColor"
              />
            </svg>
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-md shadow-xl py-1 z-50">
              <button
                type="button"
                onClick={async () => {
                  await disconnect();
                  setIsDropdownOpen(false);
                }}
                className="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 text-red-500 font-semibold focus:outline-none focus:bg-gray-800 transition-colors"
              >
                Disconnect Wallet
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 text-gray-300 focus:outline-none focus:bg-gray-800 transition-colors"
              >
                Copy Address
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
          className={`flex items-center justify-center text-white bg-[#15A350] hover:bg-[#128F43] py-2 px-5 rounded-full text-sm font-medium transition-colors disabled:opacity-70 ${focusClasses}`}
        >
          {loading ? "Connecting..." : "Connect Wallet"}
        </button>
      )}
      {error && (
        <span
          data-testid="wallet-error"
          className="text-xs text-red-200 absolute -bottom-6 right-0 whitespace-nowrap bg-red-900/90 border border-red-700/50 px-2 py-0.5 rounded shadow-lg"
        >
          {error}
        </span>
      )}
    </div>
  );
};

export default WalletConnectButton;
