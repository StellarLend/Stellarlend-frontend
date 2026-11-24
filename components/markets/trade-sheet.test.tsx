import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TradeSheet from "./trade-sheet";

describe("TradeSheet", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <TradeSheet open={false} onClose={vi.fn()}>
        <p>Trade content</p>
      </TradeSheet>,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders the title, subtitle, children, and an accessible close button when open", () => {
    render(
      <TradeSheet
        open
        onClose={vi.fn()}
        title="XLM"
        subtitle="Stellar Lumens"
      >
        <p>Trade content</p>
      </TradeSheet>,
    );

    expect(screen.getByRole("dialog", { name: "XLM" })).toBeInTheDocument();
    expect(screen.getByText("Stellar Lumens")).toBeInTheDocument();
    expect(screen.getByText("Trade content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close trade panel" }),
    ).toBeInTheDocument();
  });

  it("calls onClose once when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <TradeSheet open onClose={onClose}>
        <p>Trade content</p>
      </TradeSheet>,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose once when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <TradeSheet open onClose={onClose}>
        <p>Trade content</p>
      </TradeSheet>,
    );

    await user.click(screen.getByTestId("trade-sheet-backdrop"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when content inside the sheet is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <TradeSheet open onClose={onClose}>
        <button type="button">Continue</button>
      </TradeSheet>,
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
