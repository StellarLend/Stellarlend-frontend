"use client";

import React from "react";
import Image from "next/image";
import WalletConnectButton from "@/components/features/wallet/WalletConnectButton";

const focusClasses = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const Header: React.FC = () => {

  return (
    <header className="bg-black text-white w-full border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="StellarLend logo"
            width={140}
            height={40}
            className="h-10 w-auto"
          />
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <a
            href="#how-it-works"
            className="hover:text-white transition-colors"
          >
            How It Works
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a
            href="#testimonials"
            className="hover:text-white transition-colors"
          >
            Testimonials
          </a>
        </nav>

        {/* Wallet Interaction */}
        <div className="flex items-center gap-3 relative">
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
};

export default Header;
