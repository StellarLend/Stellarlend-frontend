import React from 'react';
import { render, screen } from '@testing-library/react';
import TopNav from './TopNav';

import TopNav from "./TopNav";
import { SidebarProvider } from "@/context/SidebarContext";

const renderTopNav = () =>
    render(
        <SidebarProvider>
          <TopNav />
        </SidebarProvider>
    );

describe("TopNav Accessibility", () => {
  it("renders notification button with proper aria-label", () => {
    renderTopNav();

    const notificationButton = screen.getAllByRole("button", {
      name: /view notifications/i,
    });

    expect(notificationButton.length).toBeGreaterThan(0);
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

  it("network selector and wallet buttons have accessible content", () => {
    renderTopNav();

    const networkButton = screen.getByRole("button", {
      name: /select network/i,
    });

    const walletButton = screen.getByRole("button", {
      name: /connected wallet/i,
    });

    expect(networkButton).toBeInTheDocument();
    expect(walletButton).toBeInTheDocument();
  });
});