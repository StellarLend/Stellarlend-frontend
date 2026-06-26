import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { SideNav } from "./SideNav";
import { SidebarProvider } from "@/context/SidebarContext";

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

describe("SideNav responsive states", () => {
  beforeAll(() => {
    if (!window.matchMedia) {
      window.matchMedia = () => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
    }
  });

  it("renders expanded desktop navigation", async () => {
    render(
      <SidebarProvider initialSidebarOpen initialIsMobile={false}>
        <SideNav />
      </SidebarProvider>
    );

    expect(await screen.findByRole("navigation", { name: /Main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
  });

  it("renders collapsed icon-only rail on desktop", async () => {
    render(
      <SidebarProvider initialSidebarOpen={false} initialIsMobile={false}>
        <SideNav />
      </SidebarProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Dashboard/i, { selector: "span:not(.sr-only)" })).toBeNull();
    });

    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
  });

  it("opens mobile drawer with overlay and locks body scroll", async () => {
    render(
      <SidebarProvider initialSidebarOpen initialIsMobile>
        <SideNav />
      </SidebarProvider>
    );

    const drawer = await screen.findByRole("dialog", { name: /Navigation drawer/i });
    expect(drawer).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    const closeButton = screen.getByRole("button", { name: /close navigation drawer/i });
    expect(closeButton).toBeInTheDocument();
    await waitFor(() => expect(closeButton).toHaveFocus());

    const overlay = screen.getByTestId("sidenav-overlay");
    await userEvent.click(overlay);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Navigation drawer/i })).toBeNull());
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
