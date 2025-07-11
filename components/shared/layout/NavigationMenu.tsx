"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import useSidebar from "@/context/SidebarContext";
import { Notification } from "../ui/icons/Notification";
import { LoginCircleFill } from "../ui/icons";
import { ArrowLeftRightLine } from "../ui/icons/ArrowLeftRightLine";
import { DashboardFill } from "../ui/icons/DashboardFill";
import { ReceiptFill } from "../ui/icons/ReceiptFill";
import { Settings5Fill } from "../ui/icons/Settings5Fill";
import { WalletFill } from "../ui/icons/WalletFill";
import { Bank } from "../ui/icons/Bank";
import { CoinIcon } from "../ui/icons/CoinIcon";
import { TransactionIcon } from "../ui/icons/TransactionIcon";
import Link from "next/link";

type NavigationMenuProps = {
  visibleLinks?: string[];
};

export const NavigationMenu = ({ visibleLinks }: NavigationMenuProps) => {
  const [activeLink, setActiveLink] = useState("dashboard");
  const { isSidebarOpen, isMobile } = useSidebar();

  useEffect(() => {
    const savedLink = localStorage.getItem("activeLink");
    if (savedLink) setActiveLink(savedLink);
  }, []);

  const links = [
    {
      link: "Dashboard",
      path: "/dashboard",
      icon: (color: string) => <DashboardFill color={color} />,
    },
    {
      link: "Fundwallet",
      icon: (color: string) => <WalletFill color={color} />,
    },
    {
      link: "Loan",
      path: "/dashboard/loan",
      icon: (color: string) => <Bank color={color} />,
    },
    { link: "Lending", icon: (color: string) => <CoinIcon color={color} /> },
    {
      link: "Cash and receipt",
      path: "/dashboard/",
      icon: (color: string) => <ReceiptFill color={color} />,
    },
    {
      link: "Transactions",
      path: "/dashboard/transactions",
      icon: (color: string) => <TransactionIcon color={color} />,
    },
    {
      link: "Notification",
      path: "/dashboard/",
      icon: (color: string) => <Notification color={color} />,
    },
    {
      link: "Settings",
      path: "/dashboard/settings",
      icon: (color: string) => <Settings5Fill color={color} />,
    },
    {
      link: "Log Out",
      icon: (color: string) => <LoginCircleFill color={color} />,
    },
  ];

  const filteredLinks = visibleLinks
    ? links.filter((l) => visibleLinks.includes(l.link))
    : links;

  const transactionNotification = 10;

  return (
    <nav>
      <ul className="space-y-1 flex items-center flex-col">
        {filteredLinks.map((link, index) => {
          const isActive = activeLink.toLowerCase() === link.link.toLowerCase();
          const iconColor = "#1C1A1A";

          const handleClick = () => {
            setActiveLink(link.link);
            localStorage.setItem("activeLink", link.link);
          };

          return (
            <Link
              key={link.path ?? link.link}
              href={link.path || "#"}
              className="w-full"
            >
              <li
                key={index}
                onClick={handleClick}
                className={`cursor-pointer py-4 px-3 w-full relative rounded-lg flex justify-between items-center transition-colors duration-150
                ${isActive ? "bg-[#15A350] " : "hover:bg-[#94e0b4a9]"}
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
            </Link>
          );
        })}
      </ul>
    </nav>
  );
};
