import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import HowItWorks from "./HowItWorks";

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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("HowItWorks accessibility", () => {
  it("exposes a labelled section and ordered steps", () => {
    render(<HowItWorks />);
    expect(
      screen.getByRole("region", { name: /how it works/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /how it works/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("links Start Lending to /lending with focus-visible styles", () => {
    render(<HowItWorks />);
    const links = screen.getAllByRole("link", { name: /start lending/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/lending");
      expect(link.className).toMatch(/focus-visible:ring/);
    }
  });

  it("uses high-contrast muted copy on black", () => {
    render(<HowItWorks />);
    const body = screen.getByText(/get started in minutes/i);
    expect(body).toHaveStyle({ color: "#D1D5DB" });
  });

  it("drops transition classes under reduced motion", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<HowItWorks />);
    const link = screen.getAllByRole("link", { name: /start lending/i })[0];
    expect(link.className).not.toMatch(/duration-300/);
  });

  it("has no serious axe violations", async () => {
    const { container } = render(<HowItWorks />);
    const results = await axe.run(container);
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious).toEqual([]);
  }, 15000);
});
