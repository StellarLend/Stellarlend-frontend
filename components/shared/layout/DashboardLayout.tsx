import React, { Component, ErrorInfo, ReactNode } from "react";
import TopNav from "@/components/shared/layout/TopNav";
import { SideNav } from "./SideNav";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class SafeLayoutRegion extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("DashboardLayout region error caught:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex">
      <SafeLayoutRegion fallback={<div data-testid="sidenav-fallback" className="w-64 bg-gray-100 min-h-screen p-4">Navigation unavailable</div>}>
        <SideNav />
      </SafeLayoutRegion>
      <div className="w-full min-h-screen bg-[#15A350] flex flex-col">
        <SafeLayoutRegion fallback={<div data-testid="topnav-fallback" className="w-full h-16 bg-gray-100 p-4">Header unavailable</div>}>
          <TopNav />
        </SafeLayoutRegion>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;

