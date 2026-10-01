import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "./IconButton";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockOnClick = vi.fn();

beforeEach(() => {
  mockOnClick.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IconButton accessibility", () => {
  it("renders with the required aria-label", () => {
    render(
      <IconButton aria-label="Close dialog" onClick={mockOnClick}>
        <svg data-testid="close-icon" />
      </IconButton>,
    );

    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveAttribute(
      "aria-label",
      "Close dialog",
    );
  });

  it("has the button role and never implicitly submits a form", () => {
    render(
      <IconButton aria-label="Settings" onClick={mockOnClick}>
        <svg data-testid="settings-icon" />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    // `type="button"` is what stops an icon control inside a <form> from
    // acting as an implicit submit button.
    expect(button).toHaveAttribute("type", "button");
  });

  it("applies the shared focus-visible ring tokens", () => {
    render(
      <IconButton aria-label="Menu" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole("button")).toHaveClass(
      "focus:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-offset-2",
    );
  });
});

describe("IconButton invalid input", () => {
  it("warns (without throwing) when aria-label is missing, and stays operable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // A JS/`as any` caller can bypass the required TS prop. The component must
    // degrade to an unlabelled-but-usable control and make the mistake
    // diagnosable instead of crashing the tree.
    const props = { onClick: mockOnClick, children: <svg /> } as any;
    expect(() => render(<IconButton {...props} />)).not.toThrow();

    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("aria-label");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[IconButton] `aria-label` is required"),
    );

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("warns when aria-label is only whitespace", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<IconButton aria-label="   ">_</IconButton>);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("must be a non-empty string"),
    );
  });

  it("falls back to the default size and variant for unknown runtime values", () => {
    render(
      <IconButton
        aria-label="Boundary"
        size={"xl" as unknown as never}
        variant={"neon" as unknown as never}
        onClick={mockOnClick}
      >
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    // Defaults: md size, default variant.
    expect(button).toHaveClass("w-10", "h-10", "p-2");
    expect(button).toHaveClass("text-gray-700", "hover:bg-gray-100");
  });

  it("uses the documented defaults when size and variant are omitted", () => {
    render(<IconButton aria-label="Defaults" />);

    expect(screen.getByRole("button")).toHaveClass("w-10", "h-10", "p-2");
  });

  it("supports every documented size", () => {
    const { rerender } = render(
      <IconButton aria-label="Test" size="sm" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole("button")).toHaveClass("w-8", "h-8", "p-1.5");

    rerender(
      <IconButton aria-label="Test" size="md" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("w-10", "h-10", "p-2");

    rerender(
      <IconButton aria-label="Test" size="lg" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("w-12", "h-12", "p-3");
  });

  it("supports every documented variant", () => {
    const { rerender } = render(
      <IconButton aria-label="Test" variant="default" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole("button")).toHaveClass(
      "text-gray-700",
      "hover:bg-gray-100",
    );

    rerender(
      <IconButton aria-label="Test" variant="ghost" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveClass(
      "text-gray-600",
      "hover:bg-gray-50",
    );

    rerender(
      <IconButton aria-label="Test" variant="outline" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveClass(
      "border",
      "border-gray-300",
    );
  });

  it("passes through additional props", () => {
    render(
      <IconButton
        aria-label="Custom"
        onClick={mockOnClick}
        data-testid="custom-button"
        title="Custom tooltip"
      >
        <svg />
      </IconButton>,
    );

    expect(screen.getByTestId("custom-button")).toHaveAttribute(
      "title",
      "Custom tooltip",
    );
  });
});

describe("IconButton activation semantics", () => {
  it("invokes onClick once per click, never swallowing or duplicating it", () => {
    render(
      <IconButton aria-label="Click me" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    // Two independent, rapid clicks are two independent actions: the component
    // must not throttle or coalesce them behind the caller's back.
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(3);
  });

  it("does not synthesise a click from keydown (native activation owns it)", () => {
    render(
      <IconButton aria-label="Keyboard" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");

    // A native <button> already emits a click for Enter/Space. Dispatching
    // onClick from onKeyDown as well would fire the handler twice per press in
    // a real browser (double-submit). The component must stay out of the way.
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("activates exactly once for a real Enter keypress", async () => {
    const user = userEvent.setup();
    render(
      <IconButton aria-label="Enter" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("activates exactly once for a real Space keypress", async () => {
    const user = userEvent.setup();
    render(
      <IconButton aria-label="Space" onClick={mockOnClick}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    button.focus();

    await user.keyboard(" ");

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("does not stop propagation, so parent handlers still observe the click", () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <IconButton aria-label="Bubbles" onClick={mockOnClick}>
          <svg />
        </IconButton>
      </div>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(onParentClick).toHaveBeenCalledTimes(1);
  });
});

describe("IconButton disabled and loading states", () => {
  it("blocks both pointer and keyboard activation when disabled", () => {
    render(
      <IconButton aria-label="Disabled" onClick={mockOnClick} disabled>
        <svg data-testid="delete-icon" />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("blocks activation and swaps in a spinner while loading", () => {
    render(
      <IconButton aria-label="Save" onClick={mockOnClick} loading>
        <svg data-testid="save-icon" />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();

    expect(screen.queryByTestId("save-icon")).not.toBeInTheDocument();
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
    // The decorative spinner must not be read out as content.
    expect(button.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("lets loading win over an explicit disabled={false}", () => {
    render(
      <IconButton aria-label="Busy" onClick={mockOnClick} loading disabled={false}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("never fires onClick while disabled, even for repeated attempts", () => {
    render(
      <IconButton aria-label="Frozen" onClick={mockOnClick} disabled>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(button);
    }

    expect(mockOnClick).not.toHaveBeenCalled();
  });
});

describe("IconButton ref", () => {
  it("forwards the ref to the underlying focusable button element", () => {
    const ref = React.createRef<HTMLButtonElement>();

    render(
      <IconButton aria-label="Ref target" ref={ref}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    button.focus();

    expect(ref.current).toBe(button);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toHaveAttribute("type", "button");
    expect(ref.current).toHaveFocus();
  });

  it("keeps the same DOM node when the loading state toggles", () => {
    const ref = React.createRef<HTMLButtonElement>();

    const { rerender } = render(
      <IconButton aria-label="Stable" ref={ref} loading={false}>
        <svg />
      </IconButton>,
    );

    const initial = ref.current;

    rerender(
      <IconButton aria-label="Stable" ref={ref} loading>
        <svg />
      </IconButton>,
    );

    expect(ref.current).toBe(initial);
  });
});

describe("IconButton tooltip", () => {
  it("renders a described tooltip and keeps it out of the accessible name", () => {
    render(
      <IconButton aria-label="Help" tooltip="Explains the metric">
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Help" });
    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveTextContent("Explains the metric");
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
    // The description must not leak into the accessible name.
    expect(button).not.toHaveAccessibleName(/Explains the metric/);
  });

  it("reveals the tooltip on hover and hides it again on leave", () => {
    render(
      <IconButton aria-label="Menu" tooltip="Open navigation">
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveClass("opacity-0");
    expect(tooltip).not.toHaveClass("opacity-100");

    fireEvent.mouseEnter(button);
    expect(tooltip).toHaveClass("opacity-100");

    fireEvent.mouseLeave(button);
    expect(tooltip).toHaveClass("opacity-0");
  });

  it("reveals the tooltip on keyboard focus and hides it on blur", () => {
    render(
      <IconButton aria-label="Info" tooltip="More information">
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");
    const tooltip = screen.getByRole("tooltip");

    fireEvent.focus(button);
    expect(tooltip).toHaveClass("opacity-100");

    fireEvent.blur(button);
    expect(tooltip).toHaveClass("opacity-0");
  });

  it("composes consumer mouse/focus handlers with the tooltip behaviour", () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    render(
      <IconButton
        aria-label="Composed"
        tooltip="Tip"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    fireEvent.focus(button);
    fireEvent.mouseLeave(button);
    fireEvent.blur(button);

    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("ignores an empty tooltip entirely", () => {
    render(
      <IconButton aria-label="Empty" tooltip="">
        <svg />
      </IconButton>,
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  it("preserves a consumer-provided aria-describedby alongside the tooltip", () => {
    render(
      <>
        <p id="external-hint">External hint</p>
        <IconButton aria-label="Both" tooltip="Local tip" aria-describedby="external-hint">
          <svg />
        </IconButton>
      </>,
    );

    const button = screen.getByRole("button");
    const tooltip = screen.getByRole("tooltip");

    expect(button.getAttribute("aria-describedby")).toBe(
      `external-hint ${tooltip.id}`,
    );
  });

  it("gives every tooltip a unique DOM id", () => {
    render(
      <>
        <IconButton aria-label="First" tooltip="First tip">
          <svg />
        </IconButton>
        <IconButton aria-label="Second" tooltip="Second tip">
          <svg />
        </IconButton>
      </>,
    );

    const [first, second] = screen.getAllByRole("tooltip");
    expect(first.id).not.toBe(second.id);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-describedby", first.id);
    expect(buttons[1]).toHaveAttribute("aria-describedby", second.id);
    expect(within(buttons[0]).queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not change the DOM for callers that omit the tooltip", () => {
    render(
      <div data-testid="host">
        <IconButton aria-label="Plain" onClick={mockOnClick}>
          <svg />
        </IconButton>
      </div>,
    );

    const host = screen.getByTestId("host");
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild?.tagName).toBe("BUTTON");
  });
});

describe('IconButton failure paths and boundaries', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('does not invoke onClick when disabled and loading are both set', () => {
    render(
      <IconButton aria-label="Both" onClick={mockOnClick} disabled loading>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys while enabled', () => {
    render(
      <IconButton aria-label="Keys" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Tab' });
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('prevents concurrent double clicks while loading is toggled on', () => {
    const { rerender } = render(
      <IconButton aria-label="Save" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    rerender(
      <IconButton aria-label="Save" onClick={mockOnClick} loading>
        <svg />
      </IconButton>
    );

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('recovers and allows clicks again after loading is cleared', () => {
    const { rerender } = render(
      <IconButton aria-label="Save" onClick={mockOnClick} loading>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();

    rerender(
      <IconButton aria-label="Save" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('swallows orClick errors without leaking to consumers', () => {
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });

    render(
      <IconButton aria-label="Throw" onClick={throwing}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(() => fireEvent.click(button)).toThrow();
    expect(throwing).toHaveBeenCalledTimes(1);
  });

  it('renders an empty label without crashing', () => {
    render(
      <IconButton aria-label="" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', '');
  });

  it('renders with no children without crashing', () => {
    render(<IconButton aria-label="Empty" onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('supports undefined onClick without crashing', () => {
    render(
      <IconButton aria-label="NoHandler">
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(() => fireEvent.click(button)).not.toThrow();
  });

  it('respects disabled attribute and blocks all interaction paths', () => {
    render(
      <IconButton aria-label="Lock" onClick={mockOnClick} disabled>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('keeps aria-disabled consistent when loading is toggled', () => {
    const { rerender } = render(
      <IconButton aria-label="Load" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('aria-disabled');

    rerender(
      <IconButton aria-label="Load" onClick={mockOnClick} loading>
        <svg />
      </IconButton>
    );
    expect(button).toBeDisabled();
  });

  it('preserves additional props when disabled', () => {
    render(
      <IconButton
        aria-label="DisabledCustom"
        onClick={mockOnClick}
        disabled
        data-testid="disabled-custom"
        title="Not available"
      >
        <svg />
      </IconButton>
    );

    const button = screen.getByTestId('disabled-custom');
    expect(button).toHaveAttribute('title', 'Not available');
    expect(button).toBeDisabled();
  });

  it('forwards ref even when disabled', () => {
    const ref = React.createRef<HTMLButtonElement>();

    render(
      <IconButton aria-label="RefDisabled" ref={ref} disabled>
        <svg />
      </IconButton>,
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBeDisabled();
  });

  it('supports unknown size values without crashing', () => {
    render(
      <IconButton aria-label="Unknown" size={'xxl'} as={'any'} onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('supports unknown variant values without crashing', () => {
    render(
      <IconButton aria-label="UnknownVariant" variant={'weird'} as={'any'} onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('supports complex children nodes', () => {
    render(
      <IconButton aria-label="Complex" onClick={mockOnClick}>
        <span data-testid="wrapper">
          <svg data-testid="icon" />
        </span>
      </IconButton>
    );

    expect(screen.getByTestId('wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('stops propagation correctly for click on inner icon', () => {
    const outer = vi.fn();
    render(
      <div onClick={outer}>
        <IconButton aria-label="Inner" onClick={mockOnClick}>
          <svg data-testid="inner-icon" />
        </IconButton>
      </div>
    );

    fireEvent.click(screen.getByTestId('inner-icon'));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('does not lose focus when clicked and re-rendered', () => {
    const { rerender } = render(
      <IconButton aria-label="Focus" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();

    rerender(
      <IconButton aria-label="Focus" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );
    expect(button).toHaveFocus();
  });

  it('handles rapid successive clicks deterministically', () => {
    render(
      <IconButton aria-label="Rapid" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    for (let i = 0; i < 5; i++) {
      fireEvent.click(button);
    }
    expect(mockOnClick).toHaveBeenCalledTimes(5);
  });

  it('keeps type=button to avoid accidental form submission', () => {
    render(
      <IconButton aria-label="Submit" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('supports explicit type override', () => {
    render(
      <IconButton aria-label="Submit" type="submit" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('respects aria-labelledby override when provided', () => {
    render(
      <>
        <span id="label-id">Visual label</span>
        <IconButton aria-labelledby="label-id" onClick={mockOnClick}>
          <svg />
        </IconButton>
      </>
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-labelledby', 'label-id');
  });

  it('supports custom className merging without losing base classes', () => {
    render(
      <IconButton aria-label="Class" onClick={mockOnClick} className="custom-class">
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
    expect(button).toHaveClass('focus:outline-none');
  });

  it('supports onClick handler that inspects the event', () => {
    const handler = vi.fn((event: React.MouseEvent) => {
      expect(event.type).toBe('click');
    });

    render(
      <IconButton aria-label="Event" onClick={handler}>
        <svg />
      </IconButton>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports click with custom event options', () => {
    render(
      <IconButton aria-label="Options" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button, { detail: 2 });
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('supports multiple IconButtons without identity collisions', () => {
    const a = vi.fn();
    const b = vi.fn();

    render(
      <>
        <IconButton aria-label="A" onClick={a}>
          <svg />
        </IconButton>
        <IconButton aria-label="B" onClick={b}>
          <svg />
        </IconButton>
      </>
    );

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});
