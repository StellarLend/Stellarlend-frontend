import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "./error";

describe("Account profile error boundary", () => {
  it("renders the error message", () => {
    const error = new Error("Test error");
    const reset = vi.fn();
    
    render(<ErrorBoundary error={error} reset={reset} />);
    
    expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
    expect(screen.getByText("We encountered an unexpected error while loading your profile. Please try again.")).toBeInTheDocument();
  });

  it("calls reset function when Try again button is clicked", () => {
    const error = new Error("Test error");
    const reset = vi.fn();
    
    render(<ErrorBoundary error={error} reset={reset} />);
    
    const button = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(button);
    
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
