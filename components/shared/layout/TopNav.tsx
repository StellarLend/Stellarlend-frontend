import React, { useState } from "react";
import Image from "next/image";
import { SearchBar } from "@/components/molecules/SearchBar";
import { useSidebar } from "@/context/SidebarContext";
import { Menu } from "lucide-react";
import NotificationBell from "@/components/shared/layout/NotificationBell";
import { useWalletConnection } from "@/hooks/useWalletConnection";

declare global {
  interface Window {
    stellar?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { network: string }) => Promise<string>;
    };
  }
}

import { useWallet } from "@/hooks/useWallet";

/** Shared focus-visible classes for TopNav interactive elements */
const focusClasses = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-green-600";

export const SidebarToggle = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 ${focusClasses}`}
      aria-label="Toggle sidebar"
    >
      <Menu className="h-6 w-6" aria-hidden="true" />
    </button>
  );
};

const TopNav = () => {
  const { address: walletAddress, status, error, connect: handleConnect, disconnect } = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const loading = status === "connecting";

  const handleDisconnect = async () => {
    await disconnect();
    setIsDropdownOpen(false);
  };

  const { walletAddress, isConnected, isLoading, error, connect, disconnect } = useWalletConnection();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getShortAddress = (addr: string) => {
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  return (
    <div className="w-full flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between bg-green-600 px-6 md:px-12 py-4 rounded-md gap-4 sm:gap-0">
      {/* Search Bar */}
      <div className="w-full sm:flex-1 max-w-full sm:max-w-md text-white">
        <SearchBar placeholder="Search for token, asset, wallet address" />
      </div>

      {/* Desktop Controls */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex gap-4 items-center">
          {/* Network Selector */}
          <button
            type="button"
            aria-label="Select network"
            className={`flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-between border py-2 px-4 w-[139px] rounded-full ${focusClasses}`}
          >
            <Image src="/icons/stellar.png" alt="Stellar network" width={22} height={22} />
            <span>Stellar</span>
            <svg className="w-3 h-3 text-white" viewBox="0 0 10 6" fill="none" aria-hidden="true">
              <path d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z" fill="#FFFFFF" />
            </svg>
          </button>

          {/* Wallet Address Button or Connect Button */}
          <div className="relative flex items-center">
            {walletAddress ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Connected wallet"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-between border py-2 px-4 w-[139px] rounded-full ${focusClasses}`}
                >
                  <span>{getShortAddress(walletAddress)}</span>
                  <svg className="w-3 h-3 text-white" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                    <path d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z" fill="#FFFFFF" />
                  </svg>
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={disconnect}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 text-red-600 font-medium"
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
                disabled={isLoading && walletAddress === null}
                className={`flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-center border py-2 px-4 w-[139px] rounded-full ${focusClasses} ${isLoading ? 'opacity-80' : ''}`}
              >
                <span>{isLoading ? "Connecting..." : "Connect Wallet"}</span>
              </button>
            )}
            {error && (
              <span data-testid="wallet-error" className="text-xs text-red-200 absolute -bottom-5 right-0 whitespace-nowrap bg-red-800/80 px-2 py-0.5 rounded">
                {error}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-8 border-l" style={{ borderColor: "#71B48D" }} aria-hidden="true" />

          <div className="flex gap-4 items-center">
<NotificationBell />

            {/* Profile Avatar */}
            <button
              type="button"
              className={`rounded-full hover:ring-2 hover:ring-white/50 transition-all ${focusClasses}`}
              aria-label="View profile"
            >
              <Image src="/images/profile.jpg" alt="User profile" className="rounded-full" width={32} height={32} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex justify-between w-full items-center">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <h1 className="text-white md:text-[24px] text-xl font-bold">Dashboard</h1>
        </div>

        <div className="flex gap-4 items-center">
<NotificationBell />

          {/* Profile Avatar */}
          <button
            type="button"
            className={`rounded-full hover:ring-2 hover:ring-white/50 transition-all ${focusClasses}`}
            aria-label="View profile"
          >
            <Image src="/images/profile.jpg" alt="User profile" className="rounded-full" width={32} height={32} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
