"use client";
import { usePathname } from "next/navigation";
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
import { navClasses, navTokens } from "@/constants/design-tokens";

type NavigationMenuProps = {
  visibleLinks?: string[];
  onLinkClick?: () => void;
};

const links = [
  { link: "Dashboard",    path: "/dashboard",              icon: (c: string) => <DashboardFill color={c} /> },
  { link: "Fundwallet",   path: undefined,                 icon: (c: string) => <WalletFill color={c} /> },
  { link: "Loan",         path: "/dashboard/loan",         icon: (c: string) => <Bank color={c} /> },
  { link: "Lending",      path: undefined,                 icon: (c: string) => <CoinIcon color={c} /> },
  { link: "Cash and receipt", path: "/dashboard",          icon: (c: string) => <ReceiptFill color={c} /> },
  { link: "Transactions", path: "/dashboard/transactions", icon: (c: string) => <TransactionIcon color={c} /> },
  { link: "Notification", path: "/dashboard",              icon: (c: string) => <Notification color={c} /> },
  { link: "Settings",     path: "/dashboard/settings",     icon: (c: string) => <Settings5Fill color={c} /> },
  { link: "Log Out",      path: undefined,                 icon: (c: string) => <LoginCircleFill color={c} /> },
];

export const NavigationMenu = ({ visibleLinks, onLinkClick }: NavigationMenuProps) => {
  const pathname = usePathname();

  const filteredLinks = visibleLinks
    ? links.filter((l) => visibleLinks.includes(l.link))
    : links;

  return (
    <nav aria-label="Main navigation">
      <ul className="space-y-1 flex items-center flex-col">
        {filteredLinks.map((item) => {
          const href = item.path ?? "#";
          const isActive = item.path ? pathname === item.path : false;
          const iconColor = isActive ? navTokens.activeText : navTokens.inactiveText;

          return (
            <li key={item.path ?? item.link} className="w-full">
              <Link
                href={href}
                onClick={onLinkClick}
                className={`${navClasses.base} ${navClasses.touchTarget} w-full justify-between ${
                  isActive ? navClasses.activeDark : navClasses.inactiveDark
                } focus-visible:ring-offset-black`}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active indicator bar */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                  }`}
                  aria-hidden="true"
                />
                <div className="flex gap-3 items-center relative z-20">
                  {item.icon(iconColor)}
                  <span className={isActive ? "font-semibold" : ""}>{item.link}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
