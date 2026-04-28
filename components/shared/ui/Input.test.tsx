import { render, screen, fireEvent } from "@/test/test-utils";
import { Input } from "./Input";
import { describe, it, expect, vi } from "vitest";

describe("Input Component", () => {
  it("renders with label and placeholder", () => {
    render(<Input label="Username" placeholder="Enter username" />);
    
    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
  });

  it("displays error message and applies error styles", () => {
    const { container } = render(<Input label="Email" error="Invalid email" />);
    
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    const input = screen.getByLabelText("Email");
    expect(input).toHaveClass("border-red-500");
  });

  it("displays helper text", () => {
    render(<Input label="Password" helperText="Must be 8 characters" />);
    
    expect(screen.getByText("Must be 8 characters")).toBeInTheDocument();
  });

  it("renders as a textarea when multiline is true", () => {
    render(<Input label="Bio" multiline placeholder="Tell us about yourself" />);
    
    const textarea = screen.getByPlaceholderText("Tell us about yourself");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Input label="Static" disabled />);
    
    const input = screen.getByLabelText("Static");
    expect(input).toBeDisabled();
    expect(input).toHaveClass("bg-gray-50");
  });

  it("calls onChange handler when value changes", () => {
    const handleChange = vi.fn();
    render(<Input label="Name" onChange={handleChange} />);
    
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "John" } });
    
    expect(handleChange).toHaveBeenCalled();
  });

  it("shows required asterisk when required is true", () => {
    render(<Input label="Email" required />);
    
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});
