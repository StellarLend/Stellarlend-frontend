/**
 * Tests for app/account/sessions/page.tsx
 *
 * The page renders inside the Sidebar + PageHeader shell and mounts the
 * SessionsList feature component. Full list / revoke / error behaviour is
 * covered in
 * components/features/account/components/SessionsList.test.tsx; here we only
 * assert the page wiring.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AccountSessionsPage from "./page";

// Sidebar uses usePathname / useSidebar hooks – stub it out.
vi.mock("@/components/shared/layout/Sidebar", () => ({
  default: () => <nav data-testid="sidebar" />,
}));

// Keep the page test focused on wiring; SessionsList has its own suite.
vi.mock("@/components/features/account/components", () => ({
  SessionsList: () => <div data-testid="sessions-list" />,
}));

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sessions: [] }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AccountSessionsPage", () => {
  it("renders the page header", () => {
    render(<AccountSessionsPage />);
    expect(screen.getByText("Active sessions")).toBeInTheDocument();
  });

  it("mounts the sidebar shell", () => {
    render(<AccountSessionsPage />);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("mounts the SessionsList feature component", () => {
    render(<AccountSessionsPage />);
    expect(screen.getByTestId("sessions-list")).toBeInTheDocument();
  });
});
