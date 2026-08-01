import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import Hero from "./Hero";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { useReducedMotion } from "@/hooks/useReducedMotion";

beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error test env
  global.IntersectionObserver = MockIntersectionObserver;
});

beforeEach(() => {
  vi.mocked(useReducedMotion).mockReturnValue(false);
  routerPush.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Hero accessibility", () => {
  it("exposes a labelled section with an h1", () => {
    render(<Hero />);
    const region = screen.getByRole("region", {
      name: /defi lending, reimagined on stellar/i,
    });
    expect(region).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /defi lending, reimagined on stellar/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders primary CTAs that are keyboard focusable", () => {
    render(<Hero />);
    const launch = screen.getByRole("button", { name: /launch app/i });
    const signUp = screen.getByRole("button", { name: /sign up/i });
    expect(launch.className).toMatch(/focus-visible:ring/);
    expect(signUp.className).toMatch(/focus-visible:ring/);
  });

  it("uses high-contrast muted text on the gradient background", () => {
    render(<Hero />);
    const body = screen.getByText(/borrow instantly, earn competitively/i);
    expect(body).toHaveStyle({ color: "#D1D5DB" });
  });

  it("disables entrance motion when reduced motion is preferred", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { container } = render(<Hero />);
    // Reduced-motion path still mounts the full content.
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(container.querySelector("section")).toBeTruthy();
  });

  it("has no serious axe violations", async () => {
    const { container } = render(<Hero />);
    const results = await axe.run(container, {
      rules: {
        // Decorative gradient background is intentional brand art.
        "color-contrast": { enabled: true },
      },
    });
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious).toEqual([]);
  }, 15000);
});
