"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  FC,
  ReactNode,
} from "react";

interface SidebarContextProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  isMobile: boolean;
}

interface SidebarProviderProps {
  children: ReactNode;
  initialSidebarOpen?: boolean;
  initialIsMobile?: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

// Versioned key to prevent collision and handle clear caching strategies
const STORAGE_KEY = "stellarlend_sidebar_v1:collapsed";

export const SidebarProvider: FC<SidebarProviderProps> = ({
  children,
  initialSidebarOpen,
  initialIsMobile,
}) => {
  const [isMobile, setIsMobile] = useState<boolean>(initialIsMobile ?? false);
  
  // Safe SSR default: start open unless initial overrides are provided
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(
    initialSidebarOpen ?? true
  );

  // 1. Core Window Responsive & Initialization Layer
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkDimensions = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile) {
        // Mobile layout always forces sidebars completely shut
        setIsSidebarOpen(false);
      } else if (initialSidebarOpen === undefined) {
        // Desktop recovery layout: read what the user explicitly saved
        try {
          const savedState = localStorage.getItem(STORAGE_KEY);
          if (savedState !== null) {
            // Note: Key tracks "isCollapsed", so open is the inverse
            setIsSidebarOpen(savedState !== "true");
          }
        } catch (error) {
          console.warn("Storage access denied during layout calculation:", error);
        }
      }
    };

    // Run layout evaluation immediately on mount
    checkDimensions();

    window.addEventListener("resize", checkDimensions);
    return () => window.removeEventListener("resize", checkDimensions);
  }, [initialSidebarOpen, initialIsMobile]);

  // 2. State Actions with Safe Persistence Syncing
  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const nextState = !prev;
      
      // Only persist configuration state adjustments if executed on desktop viewports
      if (!isMobile && initialSidebarOpen === undefined) {
        try {
          // If sidebar is open, it is NOT collapsed (false)
          localStorage.setItem(STORAGE_KEY, (!nextState).toString());
        } catch (error) {
          console.warn("Failed to persist sidebar state modification:", error);
        }
      }
      return nextState;
    });
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    if (!isMobile && initialSidebarOpen === undefined) {
      try {
        // Closed sidebar means collapsed is true
        localStorage.setItem(STORAGE_KEY, "true");
      } catch (error) {
        console.warn("Failed to write layout update to localStorage:", error);
      }
    }
  };

  return (
    <SidebarContext.Provider
      value={{
        isSidebarOpen,
        toggleSidebar,
        closeSidebar,
        isMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};