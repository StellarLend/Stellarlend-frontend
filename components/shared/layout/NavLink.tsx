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
        className={`
          group flex items-center gap-2 px-4 py-3.5 rounded-lg font-medium transition-all duration-200 relative
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2
          ${isActive ? 'bg-[#15A350]/10 text-[#15A350]' : 'text-[#AAABAB] hover:bg-gray-100 hover:text-[#15A350]'}
          ${className}
        `}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Active indicator */}
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
          aria-hidden="true"
        />
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={`
        group flex items-center gap-2 px-4 py-3.5 rounded-lg font-medium transition-all duration-200 relative
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2
        ${isActive ? 'bg-[#15A350]/10 text-[#15A350]' : 'text-[#AAABAB] hover:bg-gray-100 hover:text-[#15A350]'}
        ${className}
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Active indicator */}
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-md bg-[#15A350] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
        aria-hidden="true"
      />
      {children}
    </Link>
  );
};

export default NavLink;
