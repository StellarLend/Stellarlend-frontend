"use client";
import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { NavigationMenu } from "./NavigationMenu";
import { useSidebar } from "@/context/SidebarContext";

export const SideNav = () => {
  const { isSidebarOpen, closeSidebar, toggleSidebar, isMobile } = useSidebar();
  const [isMounted, setIsMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);

    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mediaQuery.matches);

    const handleMotionChange = (event: MediaQueryListEvent) => {
      setReduceMotion(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMotionChange);
    } else {
      mediaQuery.addListener(handleMotionChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMotionChange);
      } else {
        mediaQuery.removeListener(handleMotionChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMounted || !isMobile || !isSidebarOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMounted, isMobile, isSidebarOpen]);

  useEffect(() => {
    if (!isMounted || !isMobile || !isSidebarOpen || !drawerRef.current) {
      return;
    }

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
    ).filter((element) => !element.hasAttribute("disabled"));

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSidebar();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMounted, isMobile, isSidebarOpen, closeSidebar]);

  if (!isMounted) {
    return null;
  }

  const isCollapsedRail = !isSidebarOpen && !isMobile;
  const desktopWidth = isCollapsedRail ? "w-20" : "w-[320px]";
  const toggleLabel = isSidebarOpen ? "Collapse navigation" : "Expand navigation";

  return (
    <>
      <AnimatePresence>
        {isMobile && isSidebarOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              onClick={closeSidebar}
              aria-hidden="true"
              data-testid="sidenav-overlay"
            />
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation drawer"
              tabIndex={-1}
              className="fixed left-0 top-0 z-50 h-screen w-full max-w-sm overflow-y-auto bg-[#101010] shadow-2xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeInOut" }}
            >
              <div className="flex min-h-screen flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-5">
                  <div>
                    <h2 className="text-xl font-bold text-white">StellarLend</h2>
                    <p className="text-sm text-slate-300">Your dashboard navigation</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSidebar}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label="Close navigation drawer"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 p-4">
                  <NavigationMenu
                    isCollapsed={false}
                    onLinkClick={() => closeSidebar()}
                  />
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {!isMobile ? (
        <aside
          className={`sticky top-0 left-0 z-20 h-screen overflow-hidden bg-[linear-gradient(to_bottom,_#040A08_0%,_#0F1B14_25%,_#15A350_100%)] px-2 py-4 shadow-xl transition-all duration-300 ${desktopWidth}`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 px-2 pb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white font-semibold">
                  SL
                </span>
                {isSidebarOpen ? (
                  <div>
                    <h2 className="text-xl font-bold text-white">StellarLend</h2>
                    <p className="text-sm text-slate-200">Core dashboard navigation</p>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={toggleSidebar}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label={toggleLabel}
                aria-expanded={isSidebarOpen}
              >
                {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>

            <div className="px-1">
              <NavigationMenu
                isCollapsed={isCollapsedRail}
                onLinkClick={() => {
                  if (isMobile) closeSidebar();
                }}
              />
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
};
