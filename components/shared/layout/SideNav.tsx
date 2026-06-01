"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { NavigationMenu } from "./NavigationMenu";
import { useSidebar } from "@/context/SidebarContext";
import { Menu } from "lucide-react";

export const SideNav = () => {
  const { isSidebarOpen, closeSidebar, isMobile } = useSidebar();
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
    <>
      {(!isMobile || isSidebarOpen) && (
        <motion.aside
          className={`
          h-screen 
          bg-[linear-gradient(to_bottom,_black_0%,_black_65%,_#15A350_100%)]
          dark:bg-[linear-gradient(to_bottom,_#101010_0%,_#101010_55%,_#15A350_100%)]
          ${isMobile ? "fixed top-0 left-0 z-50 w-full" : "relative"}
        `}
          initial={false}
          animate={{
            width: isMobile ? "100%" : "380px", // Sidebar is always expanded now
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-6 h-full overflow-y-auto">
            {/* Header section */}
            <div className="p-6 flex justify-between items-center border-b border-[#71B48D] ">
              <h2 className="text-black dark:text-white text-2xl font-bold">
                StellarLend
              </h2>

              {isMobile && (
                <button
                  onClick={() => closeSidebar()}
                  className="text-black dark:text-white p-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2"
                  aria-label="Close sidebar"
                >
                  <X size={24} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Navigation Links */}
            <div className="space-y-8 px-4 flex flex-col">
              <NavigationMenu
                visibleLinks={[
                  "Dashboard",
                  "Loan",
                  "Transactions",
                  "Settings",
                  "Lending",
                ]}
                onLinkClick={() => {
                  if (isMobile) closeSidebar(); // Close only on mobile
                }}
              />
            </div>
          </div>
        </motion.aside>
      )}
    </>
  );
};
