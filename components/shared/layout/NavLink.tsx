"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NavLink = ({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className: string;
}) => {
  const pathname = usePathname();

  if (!href) {
    console.warn("NavLink requires a valid href prop.");
    return null;
  }

  const isActive = pathname === href;
  const isHashLink = typeof href === "string" && href.startsWith("#");

  if (isHashLink) {
    return (
      <a
        href={href}
        className={`transition-colors hover:text-white ${
          isActive ? "text-white" : "text-[#AAABAB]"
        } ${className}`}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={`transition-colors hover:text-white ${
        isActive ? "text-white bg-[#15A350]" : "text-[#AAABAB]"
      } ${className}`}
    >
      {children}
    </Link>
  );
};

export default NavLink;
