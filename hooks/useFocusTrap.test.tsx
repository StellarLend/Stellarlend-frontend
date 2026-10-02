import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useFocusTrap } from "./useFocusTrap";

function FocusTrapHarness({
  isActive,
  onEscape,
}: {
  isActive: boolean;
  onEscape: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, { isActive, onEscape });

  return (
    <>
      <button type="button">Opener</button>
      <div ref={dialogRef}>
        <button type="button">First</button>
        <button type="button" disabled>
          Disabled
        </button>
        <div inert>
          <button type="button">Inert</button>
        </div>
        <button type="button">Last</button>
      </div>
    </>
  );
}

describe("useFocusTrap", () => {
  it("wraps focus in both directions and skips disabled and inert elements", () => {
    const onEscape = vi.fn();
    render(<FocusTrapHarness isActive onEscape={onEscape} />);

    const opener = screen.getByRole("button", { name: "Opener" });
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);

    opener.focus();
    expect(opener).toHaveFocus();
  });

  it("restores focus to the previously focused element when deactivated", () => {
    const onEscape = vi.fn();
    const { rerender } = render(
      <FocusTrapHarness isActive={false} onEscape={onEscape} />,
    );
    const opener = screen.getByRole("button", { name: "Opener" });
    opener.focus();

    rerender(<FocusTrapHarness isActive onEscape={onEscape} />);
    screen.getByRole("button", { name: "First" }).focus();
    rerender(<FocusTrapHarness isActive={false} onEscape={onEscape} />);

    expect(opener).toHaveFocus();
  });
});
