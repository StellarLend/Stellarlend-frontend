import { render, screen, fireEvent } from "@/test/test-utils";
import Button from "./Button";
import { describe, it, expect, vi } from "vitest";

describe("Button Component", () => {
  it("renders children correctly", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText("Click Me")).toBeInTheDocument();
  });

  it("renders text prop for backward compatibility", () => {
    render(<Button text="Legacy Text" />);
    expect(screen.getByText("Legacy Text")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Action</Button>);
    
    fireEvent.click(screen.getByText("Action"));
    expect(handleClick).toHaveBeenCalled();
  });

  it("shows loading spinner and disables button when isLoading is true", () => {
    render(<Button isLoading>Processing</Button>);
    
    expect(screen.getByRole("button")).toBeDisabled();
    // Check for SVG (spinner)
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveClass("disabled:opacity-50");
  });

  it("applies variant styles correctly", () => {
    const { rerender } = render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-red-500");
    
    rerender(<Button variant="success">Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-green-500");
  });

  it("applies fullWidth style when prop is true", () => {
    render(<Button fullWidth>Wide Button</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });
});
