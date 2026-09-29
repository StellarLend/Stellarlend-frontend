"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import TopNav from "@/components/shared/layout/TopNav";
import { SideNav } from "./SideNav";

type LayoutRegionName = "TopNav" | "SideNav";

interface LayoutRegionBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  regionName: LayoutRegionName;
}

interface LayoutRegionBoundaryState {
  hasError: boolean;
}

class LayoutRegionBoundary extends Component<
  LayoutRegionBoundaryProps,
  LayoutRegionBoundaryState
> {
  public state: LayoutRegionBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): LayoutRegionBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `DashboardLayout ${this.props.regionName} error caught:`,
      error,
      errorInfo,
    );
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function RegionFallback({
  label,
  testId,
}: {
  label: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex min-h-16 items-center rounded-md bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
    >
      {label}
    </div>
  );
}

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex">
      {/** Skip-to-content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#15A350] focus:shadow-lg"
      >
        Skip to main content
      </a>

      <LayoutRegionBoundary
        regionName="SideNav"
        fallback={
          <RegionFallback
            testId="sidenav-fallback"
            label="Navigation unavailable"
          />
        }
      >
        <SideNav />
      </LayoutRegionBoundary>

      <div className="flex min-h-screen w-full flex-col bg-[#15A350]">
        <LayoutRegionBoundary
          regionName="TopNav"
          fallback={
            <RegionFallback
              testId="topnav-fallback"
              label="Header unavailable"
            />
          }
        >
          <header>
            <TopNav />
          </header>
        </LayoutRegionBoundary>

        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;