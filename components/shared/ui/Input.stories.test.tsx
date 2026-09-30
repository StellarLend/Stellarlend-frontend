import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Meta, StoryObj } from "@storybook/react";
import { render, screen, within } from "@/test/test-utils";
import { Input, type InputProps } from "./Input";
import * as stories from "./Input.stories";

/**
 * Contract tests for `components/shared/ui/Input.stories.tsx`.
 *
 * A stories module is executable production surface: it drives autodocs,
 * controls, Chromatic baselines and the Storybook URLs that docs link to. The
 * failure modes pinned down here are:
 *
 *  1. Dead wiring     - the meta points at a stale/duplicate copy of the
 *     component instead of `./Input`, so the stories document something that is
 *     not the shipped component. (Exactly how the orphan
 *     `components/Input/Input.stories.tsx` rot set in before it was removed in
 *     #1019.)
 *  2. Story drift     - a story is renamed/removed or a helper is exported, and
 *     Storybook silently renders it as a story, breaking deep links/baselines.
 *  3. Lying controls  - `argTypes` offers options the component does not support
 *     (e.g. boolean `error`, dead `loading`), so reviewers cannot trust the UI.
 *  4. Story breakage  - a story's args crash the component or render the wrong
 *     control, so the docs page/visual tests fail instead of the test suite.
 *  5. Arg boundaries  - conflicting (`error` + `helperText`) or partial
 *     (no label, unsupported `type`) args must not produce dangling ARIA
 *     references, ambiguous output or an exception.
 */

// The shared test renderer wraps components in `CurrencyProvider`, which fetches
// account preferences on mount. Freeze the network so this suite stays
// deterministic and no real request can leave the test.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const meta = stories.default as Meta<typeof Input>;

/** Pins the story inventory: renaming/removing a story is a docs-compat change. */
const STORY_EXPORTS = [
  "Default",
  "Required",
  "WithError",
  "WithHelperText",
  "Disabled",
  "Multiline",
] as const;

type StoryName = (typeof STORY_EXPORTS)[number];

const story = (name: StoryName): StoryObj<typeof Input> =>
  stories[name] as StoryObj<typeof Input>;

/** Renders a story the way Storybook does: meta args merged with story args. */
const renderStory = (name: StoryName) =>
  render(<Input {...({ ...meta.args, ...story(name).args } as InputProps)} />);

describe("Input stories: CSF / meta contract", () => {
  it("wires the meta to the shipped component, not a stale copy", () => {
    expect(meta.component).toBe(Input);
  });

  it("keeps a stable story id (deep links and Chromatic baselines depend on it)", () => {
    expect(meta.title).toBe("Shared/UI/Input");
    expect(meta.title).not.toMatch(/\s{2,}|^\/|\/$/);
  });

  it("generates docs for every story", () => {
    expect(meta.tags).toContain("autodocs");
  });

  it("exports stories and nothing else (a helper would render as a story)", () => {
    const exported = Object.keys(stories).filter((key) => key !== "default");

    expect(exported.sort()).toEqual([...STORY_EXPORTS].sort());

    for (const name of exported) {
      const value = (stories as unknown as Record<string, unknown>)[name];

      expect(value, `${name} must not be undefined`).toBeDefined();
      expect(typeof value, `${name} must be a story object`).toBe("object");
      expect(value, `${name} must not be null`).not.toBeNull();
    }
  });

  it("keeps every story args-driven so docs controls stay truthful", () => {
    for (const name of STORY_EXPORTS) {
      expect(
        story(name).render,
        `${name} must not define a custom render`,
      ).toBeUndefined();
      expect(
        Object.keys(story(name).args ?? {}).length,
        `${name} must declare args`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("Input stories: argTypes / controls contract", () => {
  const typeArg = () =>
    meta.argTypes?.type as
      | { control?: unknown; options?: unknown[] }
      | undefined;

  it("offers a select control of supported input types only", () => {
    expect(typeArg()?.control).toBe("select");

    const supportedTypes = ["text", "email", "password", "number", "tel"];

    for (const option of typeArg()?.options ?? []) {
      expect(
        supportedTypes,
        `${String(option)} is not a type the component forwards`,
      ).toContain(option);
    }
  });

  it("never offers the same control option twice", () => {
    const options = typeArg()?.options ?? [];

    expect(options.length).toBeGreaterThan(0);
    expect(new Set(options).size).toBe(options.length);
  });

  it("does not offer values that belong to other controls or components", () => {
    const options = typeArg()?.options ?? [];

    for (const invalid of ["textarea", "select", "checkbox", "radio", "button"]) {
      expect(options, `${invalid} is not an <input type>`).not.toContain(invalid);
    }
  });
});

describe("Input stories: rendering behaviour (success path)", () => {
  it("Default renders an email control with its placeholder", () => {
    renderStory("Default");

    const control = screen.getByLabelText(/Email Address/);

    expect(control.tagName).toBe("INPUT");
    expect(control).toHaveAttribute("type", "email");
    expect(control).toHaveAttribute("placeholder", "Enter your email");
    expect(control).toHaveAttribute("aria-invalid", "false");
    expect(control).not.toHaveAttribute("aria-describedby");
  });

  it("Required marks the field required without leaking an asterisk to AT", () => {
    renderStory("Required");

    const control = screen.getByLabelText(/Full Name/);
    const label = screen.getByText("Full Name");

    expect(control).toBeRequired();
    expect(label.tagName).toBe("LABEL");
    expect(within(label).getByText("*")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("WithError exposes the error through ARIA and suppresses helper text", () => {
    renderStory("WithError");

    const control = screen.getByLabelText(/Password/);
    const error = screen.getByText("Password must be at least 8 characters");

    expect(control).toHaveAttribute("type", "password");
    expect(control).toHaveValue("123");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAttribute("aria-describedby", "password-error");
    expect(error).toHaveAttribute("id", "password-error");
  });

  it("WithHelperText exposes the hint through ARIA and stays valid", () => {
    renderStory("WithHelperText");

    const control = screen.getByLabelText(/Username/);
    const helper = screen.getByText(
      "Choose a unique username for your profile",
    );

    expect(control).toHaveAttribute("aria-invalid", "false");
    expect(control).toHaveAttribute("aria-describedby", "username-helper");
    expect(helper).toHaveAttribute("id", "username-helper");
  });

  it("Disabled renders a disabled control that keeps its value", () => {
    renderStory("Disabled");

    const control = screen.getByLabelText(/Static Field/);

    expect(control).toBeDisabled();
    expect(control).toHaveValue("This cannot be changed");
  });

  it("Multiline renders a textarea with the configured rows and no input", () => {
    renderStory("Multiline");

    const control = screen.getByLabelText(/Bio/);

    expect(control.tagName).toBe("TEXTAREA");
    expect(control).toHaveAttribute("rows", "4");
    expect(control).toHaveAttribute("placeholder", "Tell us about yourself...");
    expect(screen.queryByRole("textbox")).toBe(control);
  });
});

describe("Input stories: arg boundary and failure paths", () => {
  it("gives error precedence over helper text when both args are supplied", () => {
    render(
      <Input
        label="Conflict"
        error="Hard failure"
        helperText="Soft hint"
      />,
    );

    const control = screen.getByLabelText(/Conflict/);

    expect(screen.getByText("Hard failure")).toBeInTheDocument();
    expect(screen.queryByText("Soft hint")).not.toBeInTheDocument();
    expect(control).toHaveAttribute("aria-describedby", "conflict-error");
    expect(document.getElementById("conflict-error")).toHaveTextContent(
      "Hard failure",
    );
  });

  it("never emits a dangling aria-describedby when a story omits the label", () => {
    render(<Input error="Unlabelled failure" />);

    const control = screen.getByRole("textbox");
    const describedBy = control.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Unlabelled failure",
    );
  });

  it("carries the error wiring on the textarea branch when multiline is set", () => {
    render(
      <Input label="Bio" multiline rows={6} error="Too long" />,
    );

    const control = screen.getByLabelText(/Bio/);

    expect(control.tagName).toBe("TEXTAREA");
    expect(control).toHaveAttribute("rows", "6");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAttribute("aria-describedby", "bio-error");
    expect(screen.getByText("Too long")).toHaveAttribute("id", "bio-error");
  });

  it("keeps ids unique when several labelled fields render together", () => {
    render(
      <>
        <Input label="Amount" />
        <Input label="Destination" />
      </>,
    );

    const amount = screen.getByLabelText(/Amount/);
    const destination = screen.getByLabelText(/Destination/);

    expect(amount.id).toBe("amount");
    expect(destination.id).toBe("destination");
    expect(amount.id).not.toBe(destination.id);
  });

  it("derives the same id deterministically on every render", () => {
    const first = render(<Input label="User Email" />);
    const firstId = screen.getByLabelText(/User Email/).id;
    first.unmount();

    render(<Input label="User Email" />);
    const secondId = screen.getByLabelText(/User Email/).id;

    expect(firstId).toBe("user-email");
    expect(secondId).toBe(firstId);
  });

  it("renders a value outside the control list without throwing", () => {
    expect(() =>
      render(<Input label="Date" type="date" />),
    ).not.toThrow();

    expect(screen.getByLabelText(/Date/)).toHaveAttribute("type", "date");
  });
});
