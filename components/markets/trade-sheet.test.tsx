import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
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

  it("renders an accessible named dialog and close button when open", async () => {
    const { container } = render(
      <TradeSheet
        open
        onClose={vi.fn()}
        title="XLM"
        subtitle="Stellar Lumens"
      >
        <p>Trade content</p>
      </TradeSheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "XLM" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Stellar Lumens")).toBeInTheDocument();
    expect(screen.getByText("Trade content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close trade panel" }),
    ).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
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

  it("moves focus into the dialog on open and restores it when closed", async () => {
    const onClose = vi.fn();
    const renderSheet = (open: boolean) => (
      <>
        <button type="button">Open trade</button>
        <TradeSheet open={open} onClose={onClose} title="XLM">
          <button type="button">Continue</button>
        </TradeSheet>
      </>
    );
    const { rerender } = render(renderSheet(false));
    const opener = screen.getByRole("button", { name: "Open trade" });
    opener.focus();

    rerender(renderSheet(true));

    const dialog = screen.getByRole("dialog", { name: "XLM" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close trade panel" })).toHaveFocus();
    });

    rerender(renderSheet(false));
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
