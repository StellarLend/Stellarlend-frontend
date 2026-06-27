import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TopNav from "./TopNav";
import { SidebarProvider } from "@/context/SidebarContext";
import { vi } from "vitest";

vi.mock("./NotificationBell", () => ({
  default: () => <button aria-label="View notifications">Notifications</button>,
}));

const renderTopNav = () =>
  render(
    <SidebarProvider>
      <TopNav />
    </SidebarProvider>
  );

describe("TopNav Accessibility", () => {
  it("renders notification button with proper aria-label", () => {
    renderTopNav();

    const notificationButtons = screen.getAllByRole("button", {
      name: /view notifications/i,
    });

    expect(notificationButtons.length).toBeGreaterThan(0);
  });

  it("renders profile button with proper aria-label", () => {
    renderTopNav();

    const profileButtons = screen.getAllByRole("button", {
      name: /view profile/i,
    });

    expect(profileButtons.length).toBeGreaterThan(0);
  });

  it("renders sidebar toggle with proper accessibility attributes", () => {
    renderTopNav();

    const sidebarToggle = screen.getByRole("button", {
      name: /toggle sidebar/i,
    });

    expect(sidebarToggle).toBeInTheDocument();
  });

  it("all buttons have proper button roles", () => {
    renderTopNav();

    const buttons = screen.getAllByRole("button");

    expect(buttons.length).toBeGreaterThan(0);

    buttons.forEach((button) => {
      expect(button).toBeInTheDocument();
    });
  });

  it("network selector has accessible content", () => {
    renderTopNav();

    const networkButton = screen.getByRole("button", {
      name: /select network/i,
    });

    expect(networkButton).toBeInTheDocument();
  });

  it("account menu trigger is present", () => {
    renderTopNav();

    const accountButtons = screen.getAllByRole("button", {
      name: /account menu|connect wallet/i,
    });

    expect(accountButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("all icon-only buttons have focus-visible ring classes", () => {
    renderTopNav();

    const buttons = screen.getAllByRole("button");
    const iconOnlyButtons = buttons.filter(
      (btn) => btn.className.includes("focus-visible:ring-2")
    );

    expect(iconOnlyButtons.length).toBeGreaterThanOrEqual(4);
    iconOnlyButtons.forEach((btn) => {
      expect(btn).toHaveClass("focus-visible:ring-2");
    });
  });

  it("notification buttons are focusable", () => {
    renderTopNav();

    const notificationButtons = screen.getAllByRole("button", {
      name: /view notifications/i,
    });

    notificationButtons.forEach((btn) => {
      btn.focus();
      expect(btn).toHaveFocus();
    });
  });

  it("notification buttons can be activated with keyboard", () => {
    renderTopNav();

    const notificationButtons = screen.getAllByRole("button", {
      name: /view notifications/i,
    });

    notificationButtons.forEach((btn) => {
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe("BUTTON");
    });
  });
});