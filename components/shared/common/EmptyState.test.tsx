import React from 'react';
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title, description, and action button", () => {
    const onAction = vi.fn();

    render(
      <EmptyState
        title="No activity yet"
        description="Your lending and borrowing history will appear here when transactions happen."
        actionLabel="Start lending"
        onAction={onAction}
      />
    );

    expect(screen.getByRole("heading", { name: "No activity yet" })).toBeInTheDocument();
    expect(screen.getByText(/Your lending and borrowing history/)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Start lending" });
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("announces error empty states as alerts", () => {
    render(
      <EmptyState
        title="Unable to load markets"
        description="Failed to fetch market data."
        tone="error"
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText("Unable to load markets")).toBeInTheDocument();
  });

  it("does not render an action when its handler is missing", () => {
    render(
      <EmptyState
        title="No activity yet"
        description="Your history will appear here."
        actionLabel="Start lending"
      />
    );

    expect(screen.queryByRole("button", { name: "Start lending" })).not.toBeInTheDocument();
  });

  it("does not render an action when its label is missing", () => {
    render(
      <EmptyState
        title="No activity yet"
        description="Your history will appear here."
        onAction={vi.fn()}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the default tone non-alerting and supports empty content and custom presentation", () => {
    const { container } = render(
      <EmptyState
        title=""
        description=""
        icon={<span>Custom icon</span>}
        className="custom-empty-state"
      />
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("custom-empty-state");
    expect(section).not.toHaveAttribute("role", "alert");
    expect(section).not.toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("heading", { name: "" })).toBeInTheDocument();
    expect(screen.getByText("Custom icon")).toBeInTheDocument();
    expect(section?.querySelector("p")).toBeEmptyDOMElement();
  });
});
