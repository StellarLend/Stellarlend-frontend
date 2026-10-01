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

  it.each([
    { actionLabel: "Retry", onAction: undefined },
    { actionLabel: undefined, onAction: vi.fn() },
  ])("does not render an incomplete action", ({ actionLabel, onAction }) => {
    render(
      <EmptyState
        title="Unable to load markets"
        description="Markets could not be loaded."
        actionLabel={actionLabel}
        onAction={onAction}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a custom icon and applies the supplied class name", () => {
    const { container } = render(
      <EmptyState
        title="No activity"
        description="Nothing to show."
        icon={<span data-testid="custom-icon">Custom</span>}
        className="market-empty-state"
      />,
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    expect(container.querySelector("svg[aria-hidden='true']")).toBeNull();
    expect(container.querySelector("section")).toHaveClass(
      "market-empty-state",
    );
  });

  it("uses the default icon when the supplied icon is null", () => {
    const { container } = render(
      <EmptyState
        title="No activity"
        description="Nothing to show."
        icon={null}
      />,
    );

    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("renders empty title and description strings without throwing", () => {
    const { container } = render(<EmptyState title="" description="" />);

    expect(container.querySelector("h2")).toHaveTextContent("");
    expect(container.querySelector("p")).toHaveTextContent("");
  });

  it("forwards every repeated action click", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="Unable to load markets"
        description="Markets could not be loaded."
        actionLabel="Retry"
        onAction={onAction}
      />,
    );

    const button = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onAction).toHaveBeenCalledTimes(2);
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
