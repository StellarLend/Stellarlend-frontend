"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { navClasses, navTokens } from "@/constants/design-tokens";
import { IconPlaceholder } from "../ui/icons/IconPlaceholder";

// Lazy load icons to reduce initial bundle size
const Notification = dynamic(() => import("../ui/icons/Notification").then(mod => ({ default: mod.Notification })), {
  loading: () => <IconPlaceholder />,
});
const LoginCircleFill = dynamic(() => import("../ui/icons/LoginCircleFill").then(mod => ({ default: mod.LoginCircleFill })), {
  loading: () => <IconPlaceholder />,
});
const ArrowLeftRightLine = dynamic(() => import("../ui/icons/ArrowLeftRightLine").then(mod => ({ default: mod.ArrowLeftRightLine })), {
  loading: () => <IconPlaceholder />,
});
const DashboardFill = dynamic(() => import("../ui/icons/DashboardFill").then(mod => ({ default: mod.DashboardFill })), {
  loading: () => <IconPlaceholder />,
});
const ReceiptFill = dynamic(() => import("../ui/icons/ReceiptFill").then(mod => ({ default: mod.ReceiptFill })), {
  loading: () => <IconPlaceholder />,
});
const Settings5Fill = dynamic(() => import("../ui/icons/Settings5Fill").then(mod => ({ default: mod.Settings5Fill })), {
  loading: () => <IconPlaceholder />,
});
const WalletFill = dynamic(() => import("../ui/icons/WalletFill").then(mod => ({ default: mod.WalletFill })), {
  loading: () => <IconPlaceholder />,
});
const Bank = dynamic(() => import("../ui/icons/Bank").then(mod => ({ default: mod.Bank })), {
  loading: () => <IconPlaceholder />,
});
const CoinIcon = dynamic(() => import("../ui/icons/CoinIcon").then(mod => ({ default: mod.CoinIcon })), {
  loading: () => <IconPlaceholder />,
});
const TransactionIcon = dynamic(() => import("../ui/icons/TransactionIcon").then(mod => ({ default: mod.TransactionIcon })), {
  loading: () => <IconPlaceholder />,
});

type NavigationMenuProps = {
  visibleLinks?: string[];
  onLinkClick?: () => void;
  isCollapsed?: boolean;
};

export const NavigationMenu = ({
  visibleLinks,
  onLinkClick,
  isCollapsed = false,
}: NavigationMenuProps) => {
  const [activeLink, setActiveLink] = useState("dashboard");
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    const savedLink = localStorage.getItem("activeLink");
    if (savedLink) setActiveLink(savedLink);

    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname);
      const handlePopState = () => setCurrentPath(window.location.pathname);
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
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
    onLinkClick?.();
  };

  return (
    <nav aria-label="Main navigation">
      <ul className={`space-y-1 ${isCollapsed ? "items-center" : "flex-col"}`}>
        {filteredLinks.map((link) => {
          const isRouteActive = link.path ? currentPath === link.path : false;
          const isActive = link.path
            ? isRouteActive
            : activeLink.toLowerCase() === link.link.toLowerCase();
          const iconColor = isActive ? "#15A350" : "#AAABAB";

          return (
            <li
              key={link.path ? `${link.path}-${link.link}` : link.link}
              className={`w-full ${isCollapsed ? "flex justify-center" : ""}`}
            >
              <Link
                href={link.path || "#"}
                onClick={() => handleClick(link.link)}
                className={
                  `
                    group py-3.5 ${isCollapsed ? "px-0" : "px-4"} w-full relative rounded-lg flex ${
                    isCollapsed ? "justify-center" : "justify-between"
                  } items-center transition-all duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black
                    ${isActive ? "bg-[#15A350]/15 text-[#15A350]" : "text-[#AAABAB] hover:bg-white/5 hover:text-white"}
                  `}
                aria-current={isActive ? "page" : undefined}
                aria-label={link.link}
              >
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                  }`}
                  aria-hidden="true"
                />
                <div className={`flex items-center gap-3 relative z-20 ${isCollapsed ? "justify-center" : ""}`}>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                    {link.icon(iconColor)}
                  </span>
                  <span
                    className={`transition-colors duration-200 ${
                      isCollapsed ? "sr-only" : isActive ? "text-[#15A350] font-semibold" : ""
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
