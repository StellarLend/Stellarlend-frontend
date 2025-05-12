"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import useSidebar from "@/context/SidebarContext";
import { Notification } from "./ui/icons/Notification";
import { LoginCircleFill } from "./ui/icons";
import { ArrowLeftRightLine } from "./ui/icons/ArrowLeftRightLine";
import { DashboardFill } from "./ui/icons/DashboardFill";
import { ReceiptFill } from "./ui/icons/ReceiptFill";
import { Settings5Fill } from "./ui/icons/Settings5Fill";
import { WalletFill } from "./ui/icons/WalletFill";

export const NavLink = () => {
  const [activeLink, setActiveLink] = useState("dashboard");
  const { isSidebarOpen, isMobile } = useSidebar();

  useEffect(() => {
    const savedLink = localStorage.getItem("activeLink");
    if (savedLink) setActiveLink(savedLink);
  }, []);

  const links = [
    { link: "Dashboard", icon: (color: string) => <DashboardFill color={color} /> },
    { link: "Fundwallet", icon: (color: string) => <WalletFill color={color} /> },
    { link: "Cash and receipt", icon: (color: string) => <ReceiptFill color={color} /> },
    { link: "Transactions", icon: (color: string) => <ArrowLeftRightLine color={color} /> },
    { link: "Notification", icon: (color: string) => <Notification color={color} /> },
    { link: "Settings", icon: (color: string) => <Settings5Fill color={color} /> },
    { link: "Log Out", icon: (color: string) => <LoginCircleFill color={color} /> },
  ];

  const transactionNotification = 10;

  return (
    <nav>
      <ul className="space-y-1 flex items-center flex-col">
        {links.map((link, index) => {
          const isActive = activeLink.toLowerCase() === link.link.toLowerCase();
          const iconColor = "#1C1A1A";

          const handleClick = () => {
            setActiveLink(link.link);
            localStorage.setItem("activeLink", link.link);
          };

          return (
            <li
              key={index}
              onClick={handleClick}
              className={`cursor-pointer py-4 px-3 w-full relative rounded-lg flex justify-between items-center transition-colors duration-150
                ${isActive ? "bg-gray-200 dark:bg-[#1c1c1c]" : "hover:bg-gray-200 dark:hover:bg-[#1c1c1c]"}
              `}
            >
              <div className="flex gap-3 items-center relative z-20">
                {link.icon(iconColor)}
                <span
                  className={`transition-colors duration-150 ${
                    isActive ? "text-black dark:text-white" : ""
                  }`}
                >
                  {link.link}
                </span>
              </div>

              

              {isActive && (
                <motion.div
                  className="absolute left-0 top-0 w-full h-full rounded-lg z-10"
                  layoutId="activeLink-expanded"
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
