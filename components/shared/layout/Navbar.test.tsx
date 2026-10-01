import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Header, { Navbar } from "./Navbar";
import { clientLog } from "@/lib/utils/client-log";

// Mock next/navigation
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => "/",
}));

// Mock next/image to render standard img tag
vi.mock("next/image", () => ({
  default: ({ src, alt, priority, fill, className, ...rest }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-priority={priority ? "true" : undefined}
      data-fill={fill ? "true" : undefined}
      {...rest}
    />
  ),
}));

describe("Navbar (components/shared/layout/Navbar.tsx)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  let clientLogErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    clientLogErrorSpy = vi
      .spyOn(clientLog, "error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    clientLogErrorSpy.mockRestore();
  });

  describe("Rendering & Normal Operation", () => {
    it("renders root <nav> landmark with default styling and logo", () => {
      render(<Navbar />);

      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveClass("bg-black", "text-white");

      const logo = screen.getByRole("img", { name: /logo/i });
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "/logo.svg");
    });

    it("applies custom className to <nav> when provided", () => {
      render(<Navbar className="custom-test-class" />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveClass("custom-test-class");
      expect(nav).toHaveClass("bg-black");
    });

    it("renders desktop navigation links", () => {
      render(<Navbar />);

      const desktopHowItWorks = screen.getAllByRole("link", {
        name: /How It Works/i,
      });
      expect(desktopHowItWorks.length).toBeGreaterThanOrEqual(1);
      expect(desktopHowItWorks[0]).toHaveAttribute("href", "#how-it-works");

      const desktopFeatures = screen.getAllByRole("link", {
        name: /Features/i,
      });
      expect(desktopFeatures.length).toBeGreaterThanOrEqual(1);
      expect(desktopFeatures[0]).toHaveAttribute("href", "#features");

      const desktopTestimonials = screen.getAllByRole("link", {
        name: /Testimonials/i,
      });
      expect(desktopTestimonials.length).toBeGreaterThanOrEqual(1);
      expect(desktopTestimonials[0]).toHaveAttribute("href", "#testimonials");
    });

    it("renders desktop CTA buttons for 'Launch app' and 'Sign Up'", () => {
      render(<Navbar />);

      const launchButtons = screen.getAllByRole("button", {
        name: /Launch app/i,
      });
      const signUpButtons = screen.getAllByRole("button", { name: /Sign Up/i });

      expect(launchButtons.length).toBe(1);
      expect(signUpButtons.length).toBe(1);
    });

    it("initializes mobile toggle button in closed state with proper ARIA attributes", () => {
      render(<Navbar />);

      const toggleButton = screen.getByRole("button", { name: "Open menu" });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
      expect(toggleButton).toHaveAttribute(
        "aria-controls",
        "navbar-mobile-menu",
      );

      // Mobile dropdown menu should not be rendered
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
    });
  });

  describe("Mobile Menu State Transitions & Boundaries", () => {
    it("opens the mobile menu when toggle button is clicked", async () => {
      const onMenuToggle = vi.fn();
      render(<Navbar onMenuToggle={onMenuToggle} />);

      const toggleButton = screen.getByRole("button", { name: "Open menu" });
      await user.click(toggleButton);

      expect(onMenuToggle).toHaveBeenCalledWith(true);
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(toggleButton).toHaveAttribute("aria-label", "Close menu");

      const mobileMenu = screen.getByTestId("navbar-mobile-menu");
      expect(mobileMenu).toBeInTheDocument();
      expect(mobileMenu).toHaveAttribute("role", "region");
      expect(mobileMenu).toHaveAttribute("aria-label", "Mobile navigation");

      // Mobile menu renders mobile CTA buttons (now total 2 of each)
      expect(
        screen.getAllByRole("button", { name: /Launch app/i }),
      ).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: /Sign Up/i })).toHaveLength(
        2,
      );
    });

    it("closes the mobile menu when toggle button is clicked a second time", async () => {
      const onMenuToggle = vi.fn();
      const onMenuClose = vi.fn();
      render(<Navbar onMenuToggle={onMenuToggle} onMenuClose={onMenuClose} />);

      const toggleButton = screen.getByTestId("navbar-mobile-toggle");

      // First click: open
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("navbar-mobile-menu")).toBeInTheDocument();

      // Second click: close
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
      expect(toggleButton).toHaveAttribute("aria-label", "Open menu");
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();

      expect(onMenuToggle).toHaveBeenLastCalledWith(false);
      expect(onMenuClose).toHaveBeenCalledTimes(1);
    });

    it("honors initialOpen={true} prop boundary", () => {
      render(<Navbar initialOpen={true} />);

      const toggleButton = screen.getByRole("button", { name: "Close menu" });
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("navbar-mobile-menu")).toBeInTheDocument();
    });

    it("handles rapid toggle clicks deterministically without state corruption", async () => {
      const onMenuToggle = vi.fn();
      render(<Navbar onMenuToggle={onMenuToggle} />);

      const toggleButton = screen.getByTestId("navbar-mobile-toggle");

      // 10 rapid clicks (even number of toggles -> ends closed)
      for (let i = 0; i < 10; i++) {
        fireEvent.click(toggleButton);
      }

      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
      expect(onMenuToggle).toHaveBeenCalledTimes(10);
      expect(onMenuToggle).toHaveBeenLastCalledWith(false);

      // 1 more click (odd number -> ends open)
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("navbar-mobile-menu")).toBeInTheDocument();
      expect(onMenuToggle).toHaveBeenLastCalledWith(true);
    });
  });

  describe("Keyboard & Escape Key Boundary", () => {
    it("closes open mobile menu when Escape key is pressed", async () => {
      const onMenuClose = vi.fn();
      render(<Navbar initialOpen={true} onMenuClose={onMenuClose} />);

      expect(screen.getByTestId("navbar-mobile-menu")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
      expect(screen.getByTestId("navbar-mobile-toggle")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(onMenuClose).toHaveBeenCalledTimes(1);
    });

    it("also closes on 'Esc' key alias", () => {
      render(<Navbar initialOpen={true} />);

      expect(screen.getByTestId("navbar-mobile-menu")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Esc" });

      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
    });

    it("does not trigger close callback or state change on Escape when menu is already closed", () => {
      const onMenuClose = vi.fn();
      render(<Navbar initialOpen={false} onMenuClose={onMenuClose} />);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onMenuClose).not.toHaveBeenCalled();
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
    });

    it("cleans up keydown listener on unmount without errors or memory leaks", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const { unmount } = render(<Navbar initialOpen={true} />);

      unmount();
      expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  describe("Navigation Routing & Boundary Inputs", () => {
    it("navigates to default '/lending' path on desktop Launch app click", async () => {
      render(<Navbar />);

      const launchAppButton = screen.getByRole("button", {
        name: "Launch app",
      });
      await user.click(launchAppButton);

      expect(pushMock).toHaveBeenCalledWith("/lending");
    });

    it("navigates to default '/lending' path on desktop Sign Up click", async () => {
      render(<Navbar />);

      const signUpButton = screen.getByRole("button", { name: "Sign Up" });
      await user.click(signUpButton);

      expect(pushMock).toHaveBeenCalledWith("/lending");
    });

    it("navigates to custom lendingPath when provided", async () => {
      render(<Navbar lendingPath="/app/dashboard" />);

      const launchAppButton = screen.getByRole("button", {
        name: "Launch app",
      });
      await user.click(launchAppButton);

      expect(pushMock).toHaveBeenCalledWith("/app/dashboard");
    });

    it("sanitizes lendingPath boundary with leading/trailing whitespace", async () => {
      render(<Navbar lendingPath="  /custom-route  " />);

      const launchAppButton = screen.getByRole("button", {
        name: "Launch app",
      });
      await user.click(launchAppButton);

      expect(pushMock).toHaveBeenCalledWith("/custom-route");
    });

    it("falls back to '/lending' when lendingPath is empty or whitespace", async () => {
      render(<Navbar lendingPath="   " />);

      const launchAppButton = screen.getByRole("button", {
        name: "Launch app",
      });
      await user.click(launchAppButton);

      expect(pushMock).toHaveBeenCalledWith("/lending");
    });

    it("mobile Launch app CTA navigates and automatically closes mobile menu", async () => {
      const onMenuClose = vi.fn();
      render(<Navbar initialOpen={true} onMenuClose={onMenuClose} />);

      const mobileMenu = screen.getByTestId("navbar-mobile-menu");
      const mobileLaunchBtn = within(mobileMenu).getByRole("button", {
        name: "Launch app",
      });

      await user.click(mobileLaunchBtn);

      expect(pushMock).toHaveBeenCalledWith("/lending");
      expect(onMenuClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
    });

    it("mobile Sign Up CTA navigates and automatically closes mobile menu", async () => {
      const onMenuClose = vi.fn();
      render(<Navbar initialOpen={true} onMenuClose={onMenuClose} />);

      const mobileMenu = screen.getByTestId("navbar-mobile-menu");
      const mobileSignUpBtn = within(mobileMenu).getByRole("button", {
        name: "Sign Up",
      });

      await user.click(mobileSignUpBtn);

      expect(pushMock).toHaveBeenCalledWith("/lending");
      expect(onMenuClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
    });

    it("clicking mobile nav links container closes mobile menu", async () => {
      const onMenuClose = vi.fn();
      render(<Navbar initialOpen={true} onMenuClose={onMenuClose} />);

      const mobileMenu = screen.getByTestId("navbar-mobile-menu");
      const linksContainer = mobileMenu.firstElementChild as HTMLElement;

      fireEvent.click(linksContainer);

      expect(onMenuClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
    });
  });

  describe("Failure-Path & Adverse Condition Handling", () => {
    it("handles synchronous router.push errors without crashing", async () => {
      const error = new Error("Router context disconnected");
      pushMock.mockImplementationOnce(() => {
        throw error;
      });

      render(<Navbar />);

      const launchAppButton = screen.getByRole("button", {
        name: "Launch app",
      });
      await expect(user.click(launchAppButton)).resolves.not.toThrow();

      expect(clientLogErrorSpy).toHaveBeenCalledWith(
        "Navbar navigation failed",
        error,
      );
      // Navigation element remains intact and functional
      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("handles asynchronous router.push promise rejection without uncaught rejection", async () => {
      const error = new Error("Async navigation aborted");
      pushMock.mockImplementationOnce(() => Promise.reject(error));

      render(<Navbar />);

      const launchAppButton = screen.getByRole("button", {
        name: "Launch app",
      });
      await user.click(launchAppButton);

      await waitFor(() => {
        expect(clientLogErrorSpy).toHaveBeenCalledWith(
          "Navbar navigation failed",
          error,
        );
      });
    });

    it("handles custom onNavigate callback failure gracefully", async () => {
      const error = new Error("Custom navigation error");
      const onNavigate = vi.fn().mockRejectedValue(error);

      render(<Navbar onNavigate={onNavigate} />);

      const launchAppButton = screen.getByRole("button", {
        name: "Launch app",
      });
      await user.click(launchAppButton);

      await waitFor(() => {
        expect(clientLogErrorSpy).toHaveBeenCalledWith(
          "Navbar navigation failed",
          error,
        );
      });
      expect(onNavigate).toHaveBeenCalledWith("/lending");
    });

    it("handles asynchronous router.push and onNavigate resolving successfully", async () => {
      pushMock.mockResolvedValueOnce(true);
      const onNavigate = vi.fn().mockResolvedValueOnce(true);

      const { rerender } = render(<Navbar onNavigate={onNavigate} />);
      const launchAppButton = screen.getByRole("button", {
        name: "Launch app",
      });
      await user.click(launchAppButton);
      expect(onNavigate).toHaveBeenCalledWith("/lending");

      rerender(<Navbar />);
      await user.click(screen.getByRole("button", { name: "Launch app" }));
      expect(pushMock).toHaveBeenCalledWith("/lending");
    });

    it("isolates errors thrown in onMenuToggle callback without corrupting toggle state", () => {
      const faultyToggle = vi.fn().mockImplementation(() => {
        throw new Error("Consumer onMenuToggle error");
      });

      render(<Navbar onMenuToggle={faultyToggle} />);

      const toggleButton = screen.getByTestId("navbar-mobile-toggle");

      // Click should still open menu even if consumer callback threw
      fireEvent.click(toggleButton);

      expect(clientLogErrorSpy).toHaveBeenCalledWith(
        "Navbar onMenuToggle error",
        expect.any(Error),
      );
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("navbar-mobile-menu")).toBeInTheDocument();
    });

    it("isolates errors thrown in onMenuClose callback without crashing", () => {
      const faultyClose = vi.fn().mockImplementation(() => {
        throw new Error("Consumer onMenuClose error");
      });

      render(<Navbar initialOpen={true} onMenuClose={faultyClose} />);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(clientLogErrorSpy).toHaveBeenCalledWith(
        "Navbar onMenuClose error",
        expect.any(Error),
      );
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
    });
  });

  describe("Responsive Breakpoint Boundary", () => {
    it("automatically closes mobile menu when viewport matches desktop breakpoint (>=768px)", () => {
      let listener: ((e: any) => void) | null = null;

      const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn((event, handler) => {
          if (event === "change") listener = handler;
        }),
        removeEventListener: vi.fn(),
      }));

      vi.stubGlobal("matchMedia", matchMediaMock);

      const onMenuClose = vi.fn();
      render(<Navbar initialOpen={true} onMenuClose={onMenuClose} />);

      expect(screen.getByTestId("navbar-mobile-menu")).toBeInTheDocument();

      // Simulate viewport expanding to desktop width
      act(() => {
        if (listener) {
          listener({ matches: true } as MediaQueryListEvent);
        }
      });

      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
      expect(onMenuClose).toHaveBeenCalled();
    });

    it("supports legacy mediaQuery.addListener when addEventListener is not present", () => {
      let legacyListener: ((e: any) => void) | null = null;
      const legacyMatchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addListener: vi.fn((handler) => {
          legacyListener = handler;
        }),
        removeListener: vi.fn(),
      }));

      vi.stubGlobal("matchMedia", legacyMatchMedia);

      const onMenuClose = vi.fn();
      const { unmount } = render(
        <Navbar initialOpen={true} onMenuClose={onMenuClose} />,
      );

      expect(screen.getByTestId("navbar-mobile-menu")).toBeInTheDocument();

      act(() => {
        if (legacyListener) {
          legacyListener({ matches: true } as unknown as MediaQueryListEvent);
        }
      });

      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
      expect(onMenuClose).toHaveBeenCalled();

      unmount();
    });

    it("immediately closes mobile menu if mounted already at desktop width", () => {
      const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      vi.stubGlobal("matchMedia", matchMediaMock);

      render(<Navbar initialOpen={true} />);

      // Should auto-close because matches is true
      expect(screen.queryByTestId("navbar-mobile-menu")).toBeNull();
    });
  });

  describe("Compatibility & Exports", () => {
    it("exports default Header and named Navbar identically", () => {
      expect(Header).toBe(Navbar);
    });
  });
});
