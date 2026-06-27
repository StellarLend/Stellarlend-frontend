import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import Sidebar from "./Sidebar";
import { SidebarProvider } from "@/context/SidebarContext";

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

describe("Sidebar responsive navigation states", () => {
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

  it("renders desktop collapsed icon-only rail with toggle control", async () => {
    render(
      <SidebarProvider initialSidebarOpen={false} initialIsMobile={false}>
        <Sidebar />
      </SidebarProvider>
    );

    const toggle = screen.getByRole("button", { name: /Expand sidebar/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveClass("focus-visible:ring-2");

    const profileLink = screen.getByRole("link", { name: /Profile Settings/i });
    expect(profileLink).toBeInTheDocument();
    expect(screen.queryByText(/Profile Settings/i, { selector: "span:not(.sr-only)" })).toBeNull();
  });

  it("desktop toggle is keyboard-activatable", () => {
    render(
      <SidebarProvider initialSidebarOpen={false} initialIsMobile={false}>
        <Sidebar />
      </SidebarProvider>
    );

    const toggle = screen.getByRole("button", { name: /Expand sidebar/i });
    toggle.focus();
    expect(toggle).toHaveFocus();
  });

  it("opens mobile drawer with overlay and locks body scroll", async () => {
    render(
      <SidebarProvider initialSidebarOpen initialIsMobile>
        <Sidebar />
      </SidebarProvider>
    );

    const drawer = await screen.findByRole("dialog", {
      name: /Account navigation drawer/i,
    });
    expect(drawer).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    const closeButton = screen.getByRole("button", {
      name: /Close account navigation drawer/i,
    });
    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(closeButton).toHaveClass("focus-visible:ring-2");

    const overlay = screen.getByTestId("sidebar-overlay");
    await userEvent.click(overlay);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /Account navigation drawer/i })).toBeNull()
    );
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("mobile drawer close button is keyboard-activatable", async () => {
    render(
      <SidebarProvider initialSidebarOpen initialIsMobile>
        <Sidebar />
      </SidebarProvider>
    );

    const closeButton = await screen.findByRole("button", {
      name: /Close account navigation drawer/i,
    });
    expect(closeButton).toBeInTheDocument();
    closeButton.focus();
    expect(closeButton).toHaveFocus();
  });

  it("shows mobile drawer trigger when closed on small screens", () => {
    render(
      <SidebarProvider initialSidebarOpen={false} initialIsMobile>
        <Sidebar />
      </SidebarProvider>
    );

    const toggle = screen.getByRole("button", { name: /Open account navigation/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveClass("focus-visible:ring-2");
  });
});
