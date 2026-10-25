import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../button";

describe("Button component", () => {
  it("renders with default primary variant and md size", () => {
    render(<Button>{"Click me"}</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("btn");
  });

  it("applies ghost and danger variants", () => {
    const { rerender } = render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button", { name: "Ghost" }).className).toContain("btn-ghost");

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole("button", { name: "Danger" }).className).toContain("text-red-400");
  });

  it("applies size classes", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button", { name: "Small" }).className).toContain("text-xs");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button", { name: "Large" }).className).toContain("text-base");
  });

  it("fires onClick when enabled", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Enabled</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Enabled" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables button and blocks click when disabled=true", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("sets aria-busy, disables button, and blocks click when loading=true", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Submit</Button>);
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders as link when href is provided", () => {
    render(<Button href="/markets">Markets</Button>);
    const link = screen.getByRole("link", { name: "Markets" });
    expect(link).toHaveAttribute("href", "/markets");
  });

  it("renders as disabled span role=link when href is provided but loading or disabled", () => {
    render(<Button href="/markets" loading>{"Loading Link"}</Button>);
    const link = screen.getByRole("link", { name: "Loading Link" });
    expect(link.tagName.toLowerCase()).toBe("span");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("aria-busy", "true");
  });
});
