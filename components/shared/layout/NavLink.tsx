"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navClasses } from "@/constants/design-tokens";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  /** Extra Tailwind classes; optional */
  className?: string;
  /** Override active detection (e.g. for hash links or stories) */
  isActive?: boolean;
}

/** Shared active-indicator bar */
const ActiveBar = ({ active }: { active: boolean }) => (
  <span
    className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] transition-opacity ${
      active ? "opacity-100" : "opacity-0 group-hover:opacity-50"
    }`}
    aria-hidden="true"
  />
);

const NavLink = ({ href, children, className = "", isActive: isActiveProp }: NavLinkProps) => {
  const pathname = usePathname();

  if (!href) {
    console.warn("NavLink requires a valid href prop.");
    return null;
  }

  const isActive = isActiveProp ?? pathname === href;
  const stateClasses = isActive ? navClasses.active : navClasses.inactive;
  const linkClasses = `${navClasses.base} ${navClasses.touchTarget} ${stateClasses} ${className}`;

  if (href.startsWith("#")) {
    return (
      <a href={href} className={linkClasses} aria-current={isActive ? "page" : undefined}>
        <ActiveBar active={isActive} />
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={linkClasses} aria-current={isActive ? "page" : undefined}>
      <ActiveBar active={isActive} />
      {children}
    </Link>
  );
};

export default NavLink;
