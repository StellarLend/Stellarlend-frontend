"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  onLinkClick?: () => void; // ✅ optional function
};

export const NavigationMenu = ({
  visibleLinks,
  onLinkClick,
}: NavigationMenuProps) => {
  const [activeLink, setActiveLink] = useState("dashboard");

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
    {
      link: "Lending",
      icon: (color: string) => <CoinIcon color={color} />,
    },
    {
      link: "Cash and receipt",
      path: "/dashboard",
      icon: (color: string) => <ReceiptFill color={color} />,
    },
    {
      link: "Transactions",
      path: "/dashboard/transactions",
      icon: (color: string) => <TransactionIcon color={color} />,
    },
    {
      link: "Notification",
      path: "/dashboard",
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

  const handleClick = (linkName: string) => {
    setActiveLink(linkName);
    localStorage.setItem("activeLink", linkName);
    onLinkClick?.(); // ✅ optional call
  };

  return (
    <nav aria-label="Main navigation">
      <ul className="space-y-1 flex items-center flex-col">
        {filteredLinks.map((link) => {
          const isActive = activeLink.toLowerCase() === link.link.toLowerCase();
          const iconColor = isActive ? "#15A350" : "#AAABAB";

          return (
            <li key={link.path ?? link.link} className="w-full">
              <Link
                href={link.path || "#"}
                onClick={() => handleClick(link.link)}
                className={`
                  group py-3.5 px-4 w-full relative rounded-lg flex justify-between items-center transition-all duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black
                  ${isActive ? "bg-[#15A350]/15 text-[#15A350]" : "text-[#AAABAB] hover:bg-white/5 hover:text-white"}
                `}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active indicator */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
                  aria-hidden="true"
                />
                <div className="flex gap-3 items-center relative z-20">
                  {link.icon(iconColor)}
                  <span
                    className={`transition-colors duration-200 ${
                      isActive ? "text-[#15A350] font-semibold" : ""
                    }`}
                  >
                    {link.link}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
