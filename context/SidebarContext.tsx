"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
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

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const SidebarProvider: FC<SidebarProviderProps> = ({
  children,
  initialSidebarOpen,
  initialIsMobile,
}) => {
  const [isMobile, setIsMobile] = useState(initialIsMobile ?? false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    initialSidebarOpen ?? true
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (initialIsMobile !== undefined) {
      return;
    }

    const checkIsMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, [initialIsMobile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (initialSidebarOpen !== undefined) {
      return;
    }

    const saved = localStorage.getItem("sidebarOpen");
    if (saved !== null) {
      setIsSidebarOpen(saved === "true");
    }
  }, [initialSidebarOpen]);

  useEffect(() => {
    if (!isMobile && initialSidebarOpen === undefined) {
      localStorage.setItem("sidebarOpen", isSidebarOpen.toString());
    }
  }, [isSidebarOpen, isMobile, initialSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
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
