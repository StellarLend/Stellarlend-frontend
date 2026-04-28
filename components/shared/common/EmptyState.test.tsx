import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
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
});
