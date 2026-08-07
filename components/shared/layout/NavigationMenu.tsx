"use client";
import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconPlaceholder } from "../ui/icons/IconPlaceholder";

// Lazy load icons to reduce initial bundle size
const Notification = dynamic(() => import("../ui/icons/Notification").then(mod => ({ default: mod.Notification })), {
  loading: () => <IconPlaceholder />,
});
const LoginCircleFill = dynamic(() => import("../ui/icons/LoginCircleFill").then(mod => ({ default: mod.LoginCircleFill })), {
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

type NavLink = {
  link: string;
  path?: string;
  /** When true, click posts /api/auth/logout instead of navigating. */
  action?: "logout";
  icon: (color: string) => React.ReactNode;
};

type NavigationMenuProps = {
  visibleLinks?: string[];
  onLinkClick?: () => void;
  isCollapsed?: boolean;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((c) => c.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export const NavigationMenu = ({
  visibleLinks,
  onLinkClick,
  isCollapsed = false,
}: NavigationMenuProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [activeLink, setActiveLink] = useState("dashboard");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    try {
      const savedLink = localStorage.getItem("activeLink");
      if (savedLink) setActiveLink(savedLink);
    } catch {
      // storage blocked — keep default
    }
  }, []);

  const links: NavLink[] = [
    {
      link: "Dashboard",
      path: "/dashboard",
      icon: (color: string) => <DashboardFill color={color} />,
    },
    {
      link: "Fundwallet",
      path: "/dashboard/wallet",
      icon: (color: string) => <WalletFill color={color} />,
    },
    {
      link: "Loan",
      path: "/dashboard/loan",
      icon: (color: string) => <Bank color={color} />,
    },
    {
      link: "Lending",
      path: "/lending",
      icon: (color: string) => <CoinIcon color={color} />,
    },
    {
      link: "Cash and receipt",
      path: "/dashboard/cash",
      icon: (color: string) => <ReceiptFill color={color} />,
    },
    {
      link: "Transactions",
      path: "/dashboard/transactions",
      icon: (color: string) => <TransactionIcon color={color} />,
    },
    {
      link: "Notification",
      path: "/dashboard/notifications",
      icon: (color: string) => <Notification color={color} />,
    },
    {
      link: "Settings",
      path: "/dashboard/settings",
      icon: (color: string) => <Settings5Fill color={color} />,
    },
    {
      link: "Log Out",
      action: "logout",
      icon: (color: string) => <LoginCircleFill color={color} />,
    },
  ];

  const filteredLinks = visibleLinks
    ? links.filter((l) => visibleLinks.includes(l.link))
    : links;

  const persistActive = (linkName: string) => {
    setActiveLink(linkName);
    try {
      localStorage.setItem("activeLink", linkName);
    } catch {
      // ignore storage failures
    }
  };

  const handleLogout = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      if (loggingOut) return;
      setLoggingOut(true);
      persistActive("Log Out");
      onLinkClick?.();

      try {
        const csrf = readCookie("csrf-token");
        const headers: Record<string, string> = { Accept: "application/json" };
        if (csrf) headers["x-csrf-token"] = csrf;

        const response = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          headers,
        });

        // Treat 401 as already signed out.
        if (response.ok || response.status === 401) {
          if (typeof window !== "undefined") {
            window.location.assign("/");
          } else {
            router.replace("/");
          }
          return;
        }
      } catch {
        // Fall through — still leave the app shell so the user is not stuck.
      } finally {
        setLoggingOut(false);
      }

      if (typeof window !== "undefined") {
        window.location.assign("/");
      } else {
        router.replace("/");
      }
    },
    [loggingOut, onLinkClick, router],
  );

  const handleClick = (linkName: string) => {
    persistActive(linkName);
    onLinkClick?.();
  };

  return (
    <nav aria-label="Main navigation">
      <ul className={`space-y-1 ${isCollapsed ? "items-center" : "flex-col"}`}>
        {filteredLinks.map((link) => {
          const isRouteActive = link.path ? pathname === link.path : false;
          const isActive = link.path
            ? isRouteActive
            : activeLink.toLowerCase() === link.link.toLowerCase();
          const iconColor = isActive ? "#15A350" : "#AAABAB";

          if (link.action === "logout") {
            return (
              <li
                key={link.link}
                className={`w-full ${isCollapsed ? "flex justify-center" : ""}`}
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className={`
                    group py-3.5 ${isCollapsed ? "px-0" : "px-4"} w-full relative rounded-lg flex ${
                      isCollapsed ? "justify-center" : "justify-between"
                    } items-center transition-all duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black
                    text-[#AAABAB] hover:bg-white/5 hover:text-white
                    disabled:opacity-60
                  `}
                  aria-label={link.link}
                >
                  <div className={`flex items-center gap-3 relative z-20 ${isCollapsed ? "justify-center" : ""}`}>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                      {link.icon(iconColor)}
                    </span>
                    <span className={isCollapsed ? "sr-only" : ""}>{link.link}</span>
                  </div>
                </button>
              </li>
            );
          }

          return (
            <li
              key={link.path ? `${link.path}-${link.link}` : link.link}
              className={`w-full ${isCollapsed ? "flex justify-center" : ""}`}
            >
              <Link
                href={link.path || "/"}
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
