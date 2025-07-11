"use client";

import React from "react";
import Image from "next/image";
import Searchbar from "../common/Searchbar";
import { useSidebar } from "@/context/SidebarContext";
import { Menu } from "lucide-react";

export const SidebarToggle = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
};

const TopNav = () => {
  return (
    <div className="w-full flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between bg-green-600 px-6 md:px-12 py-4 rounded-md gap-4 sm:gap-0">
      {/* Search Bar */}
      <div className="w-full sm:flex-1 max-w-full sm:max-w-md text-white ">
        <Searchbar placeholder="Search for token, asset, wallet address" />
      </div>

      {/* Right Side Controls */}
      <div className="flex  items-center  gap-3">
        <div className="hidden md:flex gap-4 items-center">
          {/* Network Selector */}
          <button className="flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-between border py-2 px-4 py- w-[139px] rounded-full">
            <Image
              src="/icons/stellar.png"
              alt="Stellar"
              width={22}
              height={22}
            />
            <span>Stellar</span>
            <svg className="w-3 h-3 text-white" viewBox="0 0 10 6" fill="none">
              <path
                d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z"
                fill="#FFFFFF"
              />
            </svg>
          </button>
          {/* Wallet Address */}
          <button className="flex cursor-pointer hover:bg-white/30 items-center text-white text-sm justify-between border py-2 px-4 py- w-[139px] rounded-full">
            <span>Ga2j6...f5g3</span>
            <svg className="w-3 h-3 text-white" viewBox="0 0 10 6" fill="none">
              <path
                d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z"
                fill="#FFFFFF"
              />
            </svg>
          </button>

          {/* Divider */}
          <div className="h-8 border-l" style={{ borderColor: "#71B48D" }} />

          <div className="flex gap-4 items-center">
            {/* Notification */}
            <div className="p-2 rounded cursor-pointer">
              <Image
                src="/icons/notification.png"
                alt="Notifications"
                width={24}
                height={24}
              />
            </div>
            {/* Profile Avatar */}
            <div>
              <Image
                src="/images/profile.jpg"
                alt="profile"
                className="rounded-full cursor-pointer"
                width={32}
                height={32}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ☰ Sidebar Toggle */}
      <div className="md:hidden flex justify-between w-full items-center">
        <div className="flex items-center gap-2">
          <SidebarToggle />
          <h1 className="text-white md:text-[24px] text-xl font-bold ">
            Dashboard
          </h1>
        </div>

        <div className="flex gap-4 items-center">
          {/* Notification */}
          <div className="p-2 rounded cursor-pointer">
            <Image
              src="/icons/notification.png"
              alt="Notifications"
              width={24}
              height={24}
            />
          </div>
          {/* Profile Avatar */}
          <div>
            <Image
              src="/images/profile.jpg"
              alt="profile"
              className="rounded-full cursor-pointer"
              width={32}
              height={32}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
