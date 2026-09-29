/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

/**
 * app/page.test.tsx
 *
 * Verifies that the public landing page (/) renders the marketing Navbar
 * and NOT the dashboard TopNav, and that the dashboard page (/dashboard)
 * is wrapped in DashboardLayout (which hosts the TopNav, not the marketing
 * Navbar).
 *
 * Issue #938: app/page.tsx was rendering the dashboard TopNav on the
 * public landing page instead of the marketing Navbar.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import HomePage from "./page";
import DashboardPage from "./dashboard/page";

// ── Shared next/* mocks ───────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width?: number; height?: number }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} />
  ),
}));

// ── Mock heavy marketing sections so the test stays focused on nav ─────────────

vi.mock("@/components/marketing/Hero", () => ({
  default: () => <section data-testid="mock-hero">Hero</section>,
}));

vi.mock("@/components/marketing/HowItWorks", () => ({
  default: () => <section data-testid="mock-how-it-works">HowItWorks</section>,
}));

vi.mock("@/components/marketing/ExploreFeatures", () => ({
  default: () => <section data-testid="mock-explore-features">ExploreFeatures</section>,
}));

vi.mock("@/components/marketing/FastSecure", () => ({
  default: () => <section data-testid="mock-fast-secure">FastSecure</section>,
}));

vi.mock("@/components/marketing/testimonial", () => ({
  default: () => <section data-testid="mock-testimonials">Testimonials</section>,
}));

vi.mock("@/components/marketing/Footer", () => ({
  default: () => <footer data-testid="mock-footer">Footer</footer>,
}));

// ── Mock DashboardLayout so the dashboard test doesn't spin up TopNav/SideNav ──

vi.mock("@/components", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-dashboard-layout">{children}</div>
  ),
}));

// ── Tests for public landing page (/) ─────────────────────────────────────────

describe("Public landing page (/) — nav", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the marketing Navbar", () => {
    render(<HomePage />);

    // The marketing Navbar contains "Launch app" and "Sign Up" CTAs.
    // These buttons exist only in Navbar.tsx, not in TopNav.tsx.
    expect(screen.getAllByRole("button", { name: /launch app/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /sign up/i }).length).toBeGreaterThan(0);
  });

  it("renders a <nav> landmark for the marketing header", () => {
    render(<HomePage />);

    // Navbar.tsx renders a <nav> element as its root
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("does NOT render dashboard-only elements (sidebar toggle, wallet, search bar)", () => {
    render(<HomePage />);

    // TopNav renders a sidebar-toggle button and a wallet-balance popover;
    // neither should appear on the public landing page.
    expect(screen.queryByRole("button", { name: /toggle sidebar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /wallet/i })).toBeNull();
    expect(
      screen.queryByPlaceholderText(/search for token, asset, wallet address/i),
    ).toBeNull();
  });

  it("renders the marketing sections inside <main>", () => {
    render(<HomePage />);

    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId("mock-hero"));
    expect(main).toContainElement(screen.getByTestId("mock-how-it-works"));
  });
});

// ── Tests for dashboard page (/dashboard) — nav ───────────────────────────────

describe("Dashboard page (/dashboard) — nav", () => {
  beforeEach(() => {
    // Stub fetch so the dashboard page doesn't make real network calls
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is wrapped by DashboardLayout (which contains TopNav, not the marketing Navbar)", () => {
    render(<DashboardPage />);

    // DashboardLayout mock is rendered — confirms the dashboard uses DashboardLayout
    expect(screen.getByTestId("mock-dashboard-layout")).toBeInTheDocument();

    // The marketing Navbar CTAs must NOT be present in the dashboard
    expect(screen.queryByRole("button", { name: /launch app/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign up/i })).toBeNull();
  });
});
