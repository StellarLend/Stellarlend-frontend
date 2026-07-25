import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Home from "@/app/page";
import DashboardLayout from "./DashboardLayout";
import { SidebarProvider } from "@/context/SidebarContext";
import { WalletProvider } from "@/context/WalletContext";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => <img src={src} alt={alt} className={className} />,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock NotificationBell to simplify test tree
vi.mock("@/components/shared/layout/NotificationBell", () => ({
  default: () => <button type="button" aria-label="Notifications" />,
}));

// Mock marketing child components of Home page to isolate nav rendering
vi.mock("@/components/marketing/Hero", () => ({
  default: () => <div data-testid="mock-hero">Hero</div>,
}));
vi.mock("@/components/marketing/HowItWorks", () => ({
  default: () => <div data-testid="mock-how-it-works">How It Works</div>,
}));
vi.mock("@/components/marketing/ExploreFeatures", () => ({
  default: () => <div data-testid="mock-explore-features">Explore Features</div>,
}));
vi.mock("@/components/marketing/FastSecure", () => ({
  default: () => <div data-testid="mock-fast-secure">Fast Secure</div>,
}));
vi.mock("@/components/marketing/testimonial", () => ({
  default: () => <div data-testid="mock-testimonials">Testimonials</div>,
}));
vi.mock("@/components/marketing/Footer", () => ({
  default: () => <footer data-testid="mock-footer">Footer</footer>,
}));

describe("Nav Routing — Landing Page / vs Dashboard /dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the marketing Navbar on the public landing page (/) and NOT TopNav chrome", () => {
    render(<Home />);

    // Assert marketing Navbar is rendered
    expect(screen.getByRole("link", { name: /How It Works/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Features/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Testimonials/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Launch app/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign Up/i })).toBeInTheDocument();

    // Assert authenticated TopNav chrome is NOT rendered on /
    expect(screen.queryByPlaceholderText(/Search for token, asset, wallet address/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Toggle sidebar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Wallet balances/i })).not.toBeInTheDocument();
  });

  it("renders TopNav on the dashboard page (/dashboard) and NOT marketing Navbar", () => {
    render(
      <WalletProvider>
        <SidebarProvider>
          <DashboardLayout>
            <div>Dashboard Content</div>
          </DashboardLayout>
        </SidebarProvider>
      </WalletProvider>
    );

    // Assert dashboard TopNav chrome is rendered
    expect(screen.getByPlaceholderText(/Search for token, asset, wallet address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Toggle sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wallet balances/i })).toBeInTheDocument();

    // Assert marketing Navbar links are NOT rendered on /dashboard
    expect(screen.queryByRole("button", { name: /Launch app/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign Up/i })).not.toBeInTheDocument();
  });
});
