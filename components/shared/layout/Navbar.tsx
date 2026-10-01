"use client";

import { X, Menu } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import NavLink from "./NavLink";
import { clientLog } from "@/lib/utils/client-log";

export interface NavbarProps {
  /** Optional custom class name applied to the root nav element */
  className?: string;
  /** Initial mobile menu open state (default: false) */
  initialOpen?: boolean;
  /** Target lending route for CTAs (default: "/lending") */
  lendingPath?: string;
  /** Optional custom navigation handler override */
  onNavigate?: (path: string) => void | Promise<unknown>;
  /** Optional callback invoked whenever the mobile menu is toggled */
  onMenuToggle?: (isOpen: boolean) => void;
  /** Optional callback invoked when the mobile menu is closed */
  onMenuClose?: () => void;
}

/**
 * Public marketing navigation header.
 *
 * Invariants:
 * - Deterministic toggle & state management for mobile disclosure menu.
 * - Safely handles navigation errors/rejections from Next.js router or custom navigation callbacks.
 * - Boundary handling: closes mobile menu on Escape key press, unmount, link click, or resize to desktop (>=768px).
 * - ARIA accessibility compliance: provides aria-expanded, aria-controls, aria-label, and semantic role landmarks.
 */
const Header = ({
  className = "",
  initialOpen = false,
  lendingPath = "/lending",
  onNavigate,
  onMenuToggle,
  onMenuClose,
}: NavbarProps = {}) => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(() =>
    Boolean(initialOpen),
  );

  // Sanitize and validate lendingPath boundary input
  const targetLendingPath =
    typeof lendingPath === "string" && lendingPath.trim().length > 0
      ? lendingPath.trim()
      : "/lending";

  // Safe navigation handler with failure recovery and sanitized logging
  const handleNavigate = useCallback(
    async (path: string) => {
      try {
        if (onNavigate) {
          const res = onNavigate(path);
          if (res && typeof (res as Promise<unknown>).catch === "function") {
            await res;
          }
        } else {
          const res = router.push(path);
          if (res && typeof (res as Promise<unknown>).catch === "function") {
            await res;
          }
        }
      } catch (err: unknown) {
        clientLog.error("Navbar navigation failed", err);
      }
    },
    [router, onNavigate],
  );

  // Safe menu toggle with callback error isolation
  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => {
      const next = !prev;
      try {
        onMenuToggle?.(next);
        if (!next) {
          onMenuClose?.();
        }
      } catch (err: unknown) {
        clientLog.error("Navbar onMenuToggle error", err);
      }
      return next;
    });
  }, [onMenuToggle, onMenuClose]);

  // Safe menu close helper
  const closeMenu = useCallback(() => {
    setIsMenuOpen((prev) => {
      if (!prev) return false;
      try {
        onMenuToggle?.(false);
        onMenuClose?.();
      } catch (err: unknown) {
        clientLog.error("Navbar onMenuClose error", err);
      }
      return false;
    });
  }, [onMenuToggle, onMenuClose]);

  // Mobile CTA click handler: closes menu then initiates navigation
  const handleMobileNavigate = useCallback(
    (path: string) => {
      closeMenu();
      handleNavigate(path);
    },
    [closeMenu, handleNavigate],
  );

  // Keyboard navigation boundary: close mobile menu on Escape key
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        closeMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, closeMenu]);

  // Viewport breakpoint boundary: auto-close mobile menu if viewport widens to desktop (>= 768px)
  useEffect(() => {
    if (!isMenuOpen || typeof window === "undefined" || !window.matchMedia)
      return;

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleMediaChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        closeMenu();
      }
    };

    if (mediaQuery.matches) {
      closeMenu();
      return;
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return () => mediaQuery.removeEventListener("change", handleMediaChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleMediaChange);
      return () => mediaQuery.removeListener(handleMediaChange);
    }
  }, [isMenuOpen, closeMenu]);

  const navClasses = className
    ? `bg-black text-white w-full font-medium text-sm flex justify-center transition-colors border-b border-gray-800 ${className}`
    : "bg-black text-white w-full font-medium text-sm flex justify-center transition-colors border-b border-gray-800";

  return (
    <nav className={navClasses}>
      <div className="flex flex-col w-[90%] p-4">
        <div className="flex items-center justify-between w-full">
          <div className="h-10 w-36">
            <Image
              src="/logo.svg"
              className="!relative"
              alt="logo"
              fill
              priority
            />
          </div>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex space-x-6 items-center justify-between px-2">
            <NavLink href="#how-it-works">How It Works</NavLink>
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#testimonials">Testimonials</NavLink>
          </div>

          <div className="hidden md:flex text-white space-x-4">
            <button
              onClick={() => handleNavigate(targetLendingPath)}
              className="px-3 py-2 rounded-sm hover:border hover:border-[#15A350] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Launch app
            </button>
            <button
              onClick={() => handleNavigate(targetLendingPath)}
              className="bg-[#15A350] text-white px-3 py-2 rounded-sm hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Sign Up
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 ml-auto rounded-md hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="navbar-mobile-menu"
            data-testid="navbar-mobile-toggle"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div
            id="navbar-mobile-menu"
            data-testid="navbar-mobile-menu"
            role="region"
            aria-label="Mobile navigation"
            className="md:hidden mt-4 flex flex-col space-y-4"
          >
            <div onClick={closeMenu} className="flex flex-col space-y-4">
              <NavLink href="#how-it-works">How It Works</NavLink>
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#testimonials">Testimonials</NavLink>
            </div>
            <div className="flex flex-col w-fit text-white space-y-4">
              <button
                onClick={() => handleMobileNavigate(targetLendingPath)}
                className="px-3 py-2 rounded-sm hover:border hover:border-[#15A350] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Launch app
              </button>
              <button
                onClick={() => handleMobileNavigate(targetLendingPath)}
                className="bg-[#15A350] text-white px-3 py-2 rounded-sm hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Sign Up
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export { Header as Navbar };
export default Header;
