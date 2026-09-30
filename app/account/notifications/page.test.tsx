/**
 * Tests for app/account/notifications/page.tsx
 *
 * The page renders inside the Sidebar + PageHeader shell.
 * Actual toggle/API behaviour is covered in
 * components/features/account/components/NotificationPreferences.test.tsx.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import NotificationsPage from "./page";

// Sidebar uses usePathname / useSidebar hooks – stub them out.
vi.mock("@/components/shared/layout/Sidebar", () => ({
  default: () => <nav data-testid="sidebar" />,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/account/notifications",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({
    isSidebarOpen: true,
    isMobile: false,
    toggleSidebar: vi.fn(),
    closeSidebar: vi.fn(),
  }),
}));

const defaultPrefs = { email: true, push: true, sms: false, inApp: true };

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ notifications: defaultPrefs }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NotificationsPage", () => {
  it("renders the page header title", async () => {
    render(<NotificationsPage />);
    expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
  });

  it("renders the sidebar", () => {
    render(<NotificationsPage />);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders the NotificationPreferences component", async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("switch", { name: /toggle email/i })).toBeInTheDocument();
    });
  });
});
