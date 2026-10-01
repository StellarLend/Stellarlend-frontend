import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function getTrigger() {
  return screen.getByText("Hover me");
}

function queryTooltip() {
  return screen.queryByRole("tooltip");
}

function getTooltip() {
  return screen.getByRole("tooltip");
}

function openTooltip(trigger = getTrigger()) {
  fireEvent.mouseEnter(trigger);
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

describe("Tooltip", () => {
  it("renders the trigger child", () => {
    render(
      <Tooltip content="Helpful text">
        <button>Hover me</button>
      </Tooltip>,
    );
    expect(getTrigger()).toBeInTheDocument();
  });

  it("tooltip is hidden by default", () => {
    render(
      <Tooltip content="Helpful text">
        <button>Hover me</button>
      </Tooltip>,
    );
    expect(queryTooltip()).not.toBeInTheDocument();
  });

  describe("open / close triggers", () => {
    it("opens on hover after the delay", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      fireEvent.mouseEnter(getTrigger());
      expect(queryTooltip()).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(getTooltip()).toBeInTheDocument();
      expect(getTooltip()).toHaveTextContent("Helpful text");
    });

    it("closes on mouse leave", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      openTooltip();
      expect(getTooltip()).toBeInTheDocument();

      act(() => {
        fireEvent.mouseLeave(getTrigger());
      });
      expect(queryTooltip()).not.toBeInTheDocument();
    });

    it("opens on focus", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      fireEvent.focus(getTrigger());
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(getTooltip()).toBeInTheDocument();
    });

    it("closes on blur", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      openTooltip();
      expect(getTooltip()).toBeInTheDocument();

      act(() => {
        fireEvent.blur(getTrigger());
      });
      expect(queryTooltip()).not.toBeInTheDocument();
    });

    it("closes on Escape keydown", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      openTooltip();
      expect(getTooltip()).toBeInTheDocument();

      act(() => {
        fireEvent.keyDown(document, { key: "Escape" });
      });
      expect(queryTooltip()).not.toBeInTheDocument();
    });
  });

  describe("aria-describedby wiring", () => {
    it("sets aria-describedby on the trigger when tooltip is visible", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      expect(getTrigger()).not.toHaveAttribute("aria-describedby");

      openTooltip();
      expect(getTrigger()).toHaveAttribute("aria-describedby", getTooltip().id);
    });
  });

  describe("delay behaviour", () => {
    it("respects a custom delay", () => {
      render(
        <Tooltip content="Helpful text" delay={500}>
          <button>Hover me</button>
        </Tooltip>,
      );

      fireEvent.mouseEnter(getTrigger());
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(queryTooltip()).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(getTooltip()).toBeInTheDocument();
    });
  });

  describe("positioning", () => {
    it.each(["top", "bottom", "left", "right"] as const)(
      "renders the tooltip at position %s",
      (position) => {
        render(
          <Tooltip content="Helpful text" position={position}>
            <button>Hover me</button>
          </Tooltip>,
        );

        openTooltip();
        expect(getTooltip()).toBeInTheDocument();
      },
    );
  });

  describe("custom class names", () => {
    it("applies custom className to the tooltip", () => {
      render(
        <Tooltip content="Helpful text" className="custom-tip">
          <button>Hover me</button>
        </Tooltip>,
      );

      openTooltip();
      expect(getTooltip()).toHaveClass("custom-tip");
    });

    it("applies wrapperClassName to the wrapper", () => {
      const { container } = render(
        <Tooltip content="Helpful text" wrapperClassName="custom-wrap">
          <button>Hover me</button>
        </Tooltip>,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("custom-wrap");
    });
  });

  describe("edge cases", () => {
    it("cancels pending timeout on rapid hover in/out", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      act(() => {
        fireEvent.mouseEnter(getTrigger());
        fireEvent.mouseLeave(getTrigger());
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(queryTooltip()).not.toBeInTheDocument();
    });

    it("re-shows after hover in/out/in sequence", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      act(() => {
        fireEvent.mouseEnter(getTrigger());
        fireEvent.mouseLeave(getTrigger());
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(queryTooltip()).not.toBeInTheDocument();

      openTooltip();
      expect(getTooltip()).toBeInTheDocument();
    });

    it("hides tooltip on Escape after focus open", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      fireEvent.focus(getTrigger());
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(getTooltip()).toBeInTheDocument();

      act(() => {
        fireEvent.keyDown(document, { key: "Escape" });
      });
      expect(queryTooltip()).not.toBeInTheDocument();
    });

    it("does not respond to other keys", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      openTooltip();
      expect(getTooltip()).toBeInTheDocument();

      act(() => {
        fireEvent.keyDown(document, { key: "Enter" });
      });
      expect(getTooltip()).toBeInTheDocument();
    });

    it("cancels a pending open when Escape is pressed", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      fireEvent.mouseEnter(getTrigger());
      fireEvent.keyDown(document, { key: "Escape" });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(queryTooltip()).not.toBeInTheDocument();
    });

    it("stays open while either hover or focus remains active", () => {
      render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      fireEvent.mouseEnter(getTrigger());
      fireEvent.focus(getTrigger());
      act(() => {
        vi.advanceTimersByTime(300);
      });
      fireEvent.mouseLeave(getTrigger());
      expect(getTooltip()).toBeInTheDocument();

      fireEvent.blur(getTrigger());
      expect(queryTooltip()).not.toBeInTheDocument();
    });

    it("uses distinct tooltip IDs and descriptions for multiple instances", () => {
      render(
        <>
          <Tooltip content="First tooltip">
            <button>First trigger</button>
          </Tooltip>
          <Tooltip content="Second tooltip">
            <button>Second trigger</button>
          </Tooltip>
        </>,
      );
      const [firstTrigger, secondTrigger] = screen.getAllByRole("button");

      openTooltip(firstTrigger);
      openTooltip(secondTrigger);

      const tooltips = screen.getAllByRole("tooltip");
      expect(tooltips[0].id).not.toBe(tooltips[1].id);
      expect(firstTrigger).toHaveAttribute("aria-describedby", tooltips[0].id);
      expect(secondTrigger).toHaveAttribute("aria-describedby", tooltips[1].id);
    });

    it("preserves existing trigger handlers and aria-describedby", () => {
      const onMouseEnter = vi.fn();
      const onMouseLeave = vi.fn();
      render(
        <Tooltip content="Helpful text">
          <button
            aria-describedby="existing-description"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            Hover me
          </button>
        </Tooltip>,
      );

      fireEvent.mouseEnter(getTrigger());
      expect(onMouseEnter).toHaveBeenCalledOnce();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(getTrigger()).toHaveAttribute(
        "aria-describedby",
        `existing-description ${getTooltip().id}`,
      );

      fireEvent.mouseLeave(getTrigger());
      expect(onMouseLeave).toHaveBeenCalledOnce();
      expect(getTrigger()).toHaveAttribute("aria-describedby", "existing-description");
    });

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
      "treats invalid delay %s as zero",
      (delay) => {
        render(
          <Tooltip content="Helpful text" delay={delay}>
            <button>Hover me</button>
          </Tooltip>,
        );

        fireEvent.mouseEnter(getTrigger());
        act(() => {
          vi.advanceTimersByTime(0);
        });

        expect(getTooltip()).toBeInTheDocument();
      },
    );

    it("opens immediately for a zero delay", () => {
      render(
        <Tooltip content="Helpful text" delay={0}>
          <button>Hover me</button>
        </Tooltip>,
      );

      fireEvent.mouseEnter(getTrigger());
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(getTooltip()).toBeInTheDocument();
    });

    it("cleans up timeout on unmount while timer is pending", () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      const { unmount } = render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      act(() => {
        fireEvent.mouseEnter(getTrigger());
      });
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("removes keydown listener when unmounted", () => {
      const removeSpy = vi.spyOn(document, "removeEventListener");
      const { unmount } = render(
        <Tooltip content="Helpful text">
          <button>Hover me</button>
        </Tooltip>,
      );

      unmount();
      expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      removeSpy.mockRestore();
    });
  });
});
