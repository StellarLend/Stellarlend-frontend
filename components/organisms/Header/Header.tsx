"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useWallet } from "@/hooks/useWallet";

const focusClasses =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const Header: React.FC = () => {
  const { address, status, error, connect, disconnect } = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const loading = status === "connecting";

  const getShortAddress = (addr: string) => {
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  return (
    <header className="bg-black text-white w-full border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="StellarLend logo" width={140} height={40} className="h-10 w-auto" />
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <a href="#how-it-works" className="hover:text-white transition-colors">
            How It Works
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#testimonials" className="hover:text-white transition-colors">
            Testimonials
          </a>
        </nav>

        {/* Wallet Interaction */}
        <div className="flex items-center gap-4 relative">
          {address ? (
            <div className="relative">
              <button
                type="button"
                aria-label="Connected wallet"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center gap-2 text-white bg-gray-900 border border-gray-700 py-2 px-4 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors ${focusClasses}`}
              >
                <span>{getShortAddress(address)}</span>
                <svg className="w-3 h-3 text-white transition-transform" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                  <path d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z" fill="currentColor" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-md shadow-xl py-1 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      disconnect();
                      setIsDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 text-red-500 font-semibold focus:outline-none focus:bg-gray-800 transition-colors"
                  >
                    Disconnect Wallet
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
      </div>
    </header>
  );
};

export default Header;
