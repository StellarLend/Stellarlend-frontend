"use client";
import { useEffect, useState } from "react";
import { NavLink } from "./NavLink";
import useSidebar from "@/context/SidebarContext";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export const SideNav = () => {
  const { isSidebarOpen, setSidebarOpen, isMobile } = useSidebar();
  const [isMounted, setIsMounted] = useState(false);

  // Ensure that the component is mounted on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // If the component is not mounted yet (server-side render), return null to prevent hydration errors
  if (!isMounted) {
    return null;
  }

  return (
    <motion.aside
      className={`bg-white dark:bg-[#101010] h-screen border border-[#e5e5e5] dark:border-[#1A1A1A] ${
        isMobile ? "fixed top-0 left-0 z-50 w-full" : "relative"
      }`}
      initial={false}
      animate={{
        width: isMobile ? "100%" : "280px", // Sidebar is always expanded now
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="space-y-6 h-full overflow-y-auto">
        {/* Header section */}
        <div className="px-6 py-6 flex justify-between items-center">
          <h2 className="text-black dark:text-white text-xl font-bold">
            StellarLend
          </h2>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-black dark:text-white p-2"
            >
              <X size={24} />
            </button>
          )}
        </div>

        <div className="space-y-8 px-4">
          <NavLink />
        </div>
      </div>
    </motion.aside>
  );
};
