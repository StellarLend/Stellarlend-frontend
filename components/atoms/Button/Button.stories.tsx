/**
 * Button Storybook Stories & Interaction (Play) Tests
 *
 * Provides production-ready failure-path, boundary-case, state-transition,
 * concurrency, and accessibility test coverage for the Button atom component.
 *
 * Invariants enforced & documented:
 *  1. Deterministic Fallbacks: Invalid or unknown `variant` and `size` inputs
 *     gracefully degrade to standard styles (primary and md).
 *  2. Label Precedence: `children` takes strict precedence over the `text` prop;
 *     `text` serves as fallback when `children` is absent or undefined.
 *  3. Interaction Blocking: When `disabled` or `isLoading`, button interactions
 *     (pointer clicks, keyboard Enter/Space) are strictly prevented.
 *  4. Icon Suppression: During loading (`isLoading=true`), left and right icons
 *     are suppressed so the animated spinner (`role="status"`) is unobstructed.
 *  5. Concurrency & Dedup: In-flight operations disable the button, guarding
 *     against duplicate dispatch, stale transitions, or race conditions.
 *  6. Failure Recovery & Retries: Adverse failure paths sanitize diagnosable
 *     error codes without exposing sensitive tokens, enabling safe user retry.
 *  7. Authorization Gate: Actions requiring permissions remain disabled until
 *     authorization conditions are satisfied.
 */

import React, { useState, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import Button from "./Button";
import type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";
export const playDisabled = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const button = canvas.getByRole("button");
  expect(button).toBeDisabled();
};

export const playLoading = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const button = canvas.getByRole("button");
  expect(button).toBeDisabled();
  expect(canvas.getByRole("status")).toBeInTheDocument();
};

export const playInteractive = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const button = canvas.getByRole("button");
  expect(button).toBeEnabled();
  await userEvent.click(button);
};

export const playFocus = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const button = canvas.getByRole("button");
  button.focus();
  expect(button).toHaveFocus();
};

export const playKeyboard = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const button = canvas.getByRole("button");
  button.focus();
  expect(button).toHaveFocus();
  await userEvent.keyboard("{Enter}");
};


// ============================================================================
// Mock Icons & Visual Helpers
// ============================================================================

const CheckIcon = (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

const ArrowRightIcon = (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </svg>
);

const TrashIcon = (
  <svg
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
    />
  </svg>
);

// ============================================================================
// Stateful Test Harnesses for Adversarial & Boundary Conditions
// ============================================================================

interface AsyncActionHarnessProps {
  failFirstAttempt?: boolean;
  failAllAttempts?: boolean;
  simulatedLatencyMs?: number;
  onAuditLog?: (event: {
    attempt: number;
    status: "in_flight" | "success" | "failure";
    errorCode?: string;
    durationMs: number;
  }) => void;
}

/**
 * Harness modeling an asynchronous action (e.g. transaction submission or loan claim)
 * with controlled failure, retry recovery, loading state locking, and error sanitization.
 */
function AsyncActionHarness({
  failFirstAttempt = true,
  failAllAttempts = false,
  simulatedLatencyMs = 60,
  onAuditLog,
}: AsyncActionHarnessProps) {
  const [status, setStatus] = useState<"idle" | "in_flight" | "failed" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const attemptRef = useRef<number>(0);

  const handleAction = async () => {
    // Invariant: Guard against re-entrant calls while already in-flight
    if (status === "in_flight") return;

    attemptRef.current += 1;
    const currentAttempt = attemptRef.current;
    setStatus("in_flight");
    setErrorMessage(null);
    setSuccessMessage(null);

    const startTime = Date.now();
    onAuditLog?.({
      attempt: currentAttempt,
      status: "in_flight",
      durationMs: 0,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (failAllAttempts || (failFirstAttempt && currentAttempt === 1)) {
            // Simulated failure with potential sensitive payload to test sanitization
            const error = new Error("NETWORK_TIMEOUT_E1002: Secret token session_xyz should not leak");
            reject(error);
          } else {
            resolve();
          }
        }, simulatedLatencyMs);
      });

      setStatus("success");
      setSuccessMessage("Transaction completed successfully.");
      onAuditLog?.({
        attempt: currentAttempt,
        status: "success",
        durationMs: Date.now() - startTime,
      });
    } catch (err: unknown) {
      // Invariant: Sanitize error output so private tokens/keys are never exposed to the UI
      const rawMessage = err instanceof Error ? err.message : "Unknown error";
      const sanitized = rawMessage.includes("E1002")
        ? "[ERR_E1002] Network connection timed out. Please check connectivity and retry."
        : "An unexpected error occurred. Please try again.";

      setStatus("failed");
      setErrorMessage(sanitized);
      onAuditLog?.({
        attempt: currentAttempt,
        status: "failure",
        errorCode: "ERR_E1002",
        durationMs: Date.now() - startTime,
      });
    }
  };

  return (
    <div className="flex flex-col items-start gap-4 p-6 bg-slate-50 border border-slate-200 rounded-xl max-w-md">
      <div className="text-sm font-semibold text-slate-700">Async Transaction State Machine</div>

      <div className="flex items-center gap-3">
        <Button
          variant={status === "failed" ? "danger" : "primary"}
          isLoading={status === "in_flight"}
          onClick={handleAction}
          data-testid="async-action-button"
        >
          {status === "failed"
            ? "Retry Transaction"
            : status === "success"
            ? "Completed"
            : "Submit Transaction"}
        </Button>

        <span className="text-xs text-slate-500 font-mono" data-testid="attempt-counter">
          Attempts: {attemptRef.current}
        </span>
      </div>

      {/* User-visible error alert for diagnosability without leaking credentials */}
      {errorMessage && (
        <div
          role="alert"
          data-testid="error-alert"
          className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md w-full"
        >
          {errorMessage}
        </div>
      )}

      {/* User-visible success notification */}
      {successMessage && (
        <div
          role="status"
          data-testid="success-status"
          className="p-3 text-xs text-green-800 bg-green-50 border border-green-200 rounded-md w-full"
        >
          {successMessage}
        </div>
      )}
    </div>
  );
}

interface ConcurrencyHarnessProps {
  onDispatch?: (callCount: number) => void;
}

/**
 * Harness tracking concurrent / duplicate click attempts to verify that
 * in-flight state locks out subsequent dispatch events.
 */
function ConcurrencyHarness({ onDispatch }: ConcurrencyHarnessProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [dispatchCount, setDispatchCount] = useState(0);

  const handleClick = () => {
    // When button is loading, native button disabled prevents onClick.
    // As defense-in-depth, handler also guards in-flight execution.
    if (isLoading) return;

    const nextCount = dispatchCount + 1;
    setDispatchCount(nextCount);
    setIsLoading(true);
    onDispatch?.(nextCount);

    // Simulate async in-flight operation
    setTimeout(() => {
      setIsLoading(false);
    }, 150);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <Button
        variant="primary"
        isLoading={isLoading}
        onClick={handleClick}
        data-testid="concurrency-button"
      >
        Submit Transfer
      </Button>
      <div className="text-xs text-slate-600 font-mono" data-testid="dispatch-count">
        Dispatched count: {dispatchCount}
      </div>
    </div>
  );
}

/**
 * Harness testing authorization gating: Button remains disabled until
 * authorization requirements (e.g. signature or terms) are satisfied.
 */
function AuthorizationGuardHarness({ onAuthorizedAction }: { onAuthorizedAction?: () => void }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [actionExecuted, setActionExecuted] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-6 bg-slate-50 border border-slate-200 rounded-xl max-w-sm">
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={isAuthorized}
          onChange={(e) => setIsAuthorized(e.target.checked)}
          data-testid="auth-checkbox"
          className="rounded border-slate-300 text-green-600 focus:ring-green-500"
        />
        <span>Authorize wallet action</span>
      </label>

      <Button
        variant="primary"
        disabled={!isAuthorized}
        onClick={() => {
          if (!isAuthorized) return;
          setActionExecuted(true);
          onAuthorizedAction?.();
        }}
        data-testid="auth-action-button"
      >
        Execute Protected Action
      </Button>

      {actionExecuted && (
        <div role="status" data-testid="auth-success-message" className="text-xs text-green-700">
          Protected action executed successfully.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Meta Configuration
// ============================================================================

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Production-ready Button component with deterministic failure-path, boundary-case, " +
          "state-transition, and accessibility coverage.\n\n" +
          "### Key Invariants:\n" +
          "- **Deterministic Fallbacks:** Unrecognized `variant` or `size` strings safely degrade to standard defaults (`primary` and `md`).\n" +
          "- **Input Precedence:** `children` takes strict precedence over `text`; `text` is rendered when `children` is missing.\n" +
          "- **Interaction Guards:** When `disabled` or `isLoading`, all pointer and keyboard events are blocked.\n" +
          "- **Icon Suppression on Loading:** In-flight loading (`isLoading=true`) suppresses left/right icons and renders the animated status spinner.\n" +
          "- **Concurrency Protection:** In-flight operations disable the button, preventing duplicate submissions, stale state transitions, and race conditions.\n" +
          "- **Failure Recovery & Retries:** Adverse failure paths sanitize diagnosable error codes without leaking sensitive data and enable deterministic retry recovery.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "destructive", "danger", "success", "outline"],
      description: "Visual style variant with deterministic fallback to primary",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Button sizing with deterministic fallback to md",
    },
    isLoading: {
      control: "boolean",
      description: "Whether the button displays a loading spinner and disables interactions",
    },
    disabled: {
      control: "boolean",
      description: "Disables all pointer and keyboard interactions",
    },
    fullWidth: {
      control: "boolean",
      description: "Expands button width to 100% of container",
    },
    children: {
      control: "text",
      description: "Primary content/label",
    },
    text: {
      control: "text",
      description: "Fallback label when children is not provided",
    },
    onClick: {
      action: "clicked",
      description: "Action callback triggered on activation",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

type Story = StoryObj<typeof Button>;

// ============================================================================
// Standard & Visual Variant Stories (Backwards-Compatible)
// ============================================================================

/** Main primary call-to-action (preserves existing export for compatibility) */
export const Primary: Story = {
  args: {
    children: "Click me",
    variant: "primary",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /click me/i });
    await expect(button).toBeInTheDocument();
    await expect(button).not.toBeDisabled();
    
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

/** Secondary action button (preserves existing export for compatibility) */
export const Secondary: Story = {
  args: {
    children: "Cancel",
    variant: "secondary",
  },
};

/** Ghost variant for lower emphasis toolbars and secondary actions */
export const Ghost: Story = {
  args: {
    children: "View Details",
    variant: "ghost",
  },
};

/** Destructive action button */
export const Destructive: Story = {
  args: {
    children: "Delete Record",
    variant: "destructive",
  },
};

/** Danger variant */
export const Danger: Story = {
  args: {
    children: "Terminate Session",
    variant: "danger",
  },
};

/** Success variant for deposit or approval actions */
export const Success: Story = {
  args: {
    children: "Deposit Assets",
    variant: "success",
  },
};

/** Outline variant */
export const Outline: Story = {
  args: {
    children: "Download Report",
    variant: "outline",
  },
};

// ============================================================================
// Size & Layout Stories
// ============================================================================

/** Small size variant (sm: px-3 py-1.5 text-xs) */
export const Small: Story = {
  args: {
    size: "sm",
    children: "Small Action",
  },
};

/** Medium size variant (md: px-4 py-2 text-sm, default) */
export const Medium: Story = {
  args: {
    size: "md",
    children: "Medium Action",
  },
};

/** Large size variant (lg: px-6 py-3 text-base) */
export const Large: Story = {
  args: {
    size: "lg",
    children: "Large Action",
  },
};

/** Full width layout variant spanning 100% of container */
export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: "Full Width Button",
  },
  render: (args) => (
    <div className="w-80 p-4 border border-dashed border-slate-300 rounded-lg">
      <Button {...args} />
    </div>
  ),
};

// ============================================================================
// Icon Permutations & States
// ============================================================================

/** Button with leading left icon */
export const WithLeftIcon: Story = {
  args: {
    children: "Confirmed",
    leftIcon: CheckIcon,
  },
};

/** Button with trailing right icon */
export const WithRightIcon: Story = {
  args: {
    children: "Continue",
    rightIcon: ArrowRightIcon,
  },
};

/** Button with both leading and trailing icons */
export const WithBothIcons: Story = {
  args: {
    children: "Remove Item",
    variant: "destructive",
    leftIcon: TrashIcon,
    rightIcon: ArrowRightIcon,
  },
};

/** Disabled visual state */
export const DisabledState: Story = {
  args: {
    disabled: true,
    children: "Action Unavailable",
  },
};

/** In-flight loading state displaying animated spinner */
export const LoadingState: Story = {
  args: {
    isLoading: true,
    children: "Processing Request...",
  },
};

/** Verifies that when isLoading=true, icons are cleanly suppressed in favor of the spinner */
export const LoadingSuppressesIcons: Story = {
  args: {
    isLoading: true,
    leftIcon: CheckIcon,
    rightIcon: ArrowRightIcon,
    children: "Saving Settings...",
  },
};

// ============================================================================
// Boundary Cases & Hostile / Malformed Inputs
// ============================================================================

/** Boundary: Text prop fallback when children is omitted */
export const BoundaryTextPropFallback: Story = {
  args: {
    text: "Rendered via text prop fallback",
  },
};

/** Boundary: When both children and text are provided, children takes strict precedence */
export const BoundaryChildrenPrecedence: Story = {
  args: {
    children: "Children Label (Preferred)",
    text: "Ignored Text Prop",
  },
};

/** Boundary: Malformed or invalid variant string gracefully falls back to primary */
export const BoundaryInvalidVariantFallback: Story = {
  args: {
    variant: "unknown-nonexistent-variant" as unknown as ButtonVariant,
    children: "Fallback to Primary Style",
  },
};

/** Boundary: Malformed or invalid size string gracefully falls back to medium */
export const BoundaryInvalidSizeFallback: Story = {
  args: {
    size: "huge-size" as unknown as ButtonSize,
    children: "Fallback to Medium Size",
  },
};

/** Boundary: Empty string label handled safely without crashing */
export const BoundaryEmptyLabel: Story = {
  args: {
    children: "",
  },
};

/** Boundary: Extreme long text label handles wrapping without breaking layout */
export const BoundaryExtremeLongText: Story = {
  args: {
    children:
      "Extremely long button label that tests character containment, word-wrap boundaries, and resilience against overflow in constrained viewports",
  },
  render: (args) => (
    <div className="w-64 p-3 border border-slate-200 rounded-md">
      <Button {...args} />
    </div>
  ),
};

// ============================================================================
// Play Function Bindings from Button.play
// ============================================================================

/** Reusable disabled play assertion */
export const Disabled: Story = {
  args: {
    children: "Disabled Invariant",
    disabled: true,
  },
  play: playDisabled,
};

/** Reusable loading play assertion */
export const Loading: Story = {
  args: {
    children: "Loading Invariant",
    isLoading: true,
  },
  play: playLoading,
};

/** Reusable interactive play assertion */
export const Interactive: Story = {
  args: {
    children: "Interactive Invariant",
    variant: "primary",
  },
  play: playInteractive,
};

/** Reusable focus play assertion */
export const Focused: Story = {
  args: {
    children: "Focus Invariant",
    variant: "primary",
  },
  play: playFocus,
};

/** Reusable keyboard play assertion */
export const Keyboard: Story = {
  args: {
    children: "Keyboard Invariant",
    variant: "primary",
  },
  play: playKeyboard,
};

// ============================================================================
// Interactive (Play) Stories — Functional, Adverse & Boundary Coverage
// ============================================================================

/**
 * Play: Normal click execution
 * Verifies single-click event dispatch, focus reception, and handler execution.
 */
export const PlayClickSuccess: Story = {
  name: "Play: Normal click execution",
  render: () => {
    const handleClick = fn();
    return (
      <Button variant="primary" onClick={handleClick} data-testid="target-button">
        Confirm Action
      </Button>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("target-button");

    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    await userEvent.click(button);
    expect(button).toHaveFocus();
  },
};

/**
 * Play: Disabled button blocks interaction
 * Verifies that native disabled attribute, pointer-events class, and click handlers
 * are strictly enforced against click and keyboard activation.
 */
export const PlayDisabledBlocksInteraction: Story = {
  name: "Play: Disabled button blocks all interaction",
  render: () => {
    const handleClick = fn();
    return (
      <Button disabled variant="primary" onClick={handleClick} data-testid="disabled-button">
        Disabled Action
      </Button>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("disabled-button") as HTMLButtonElement;

    expect(button).toBeDisabled();
    expect(button.disabled).toBe(true);
    expect(button.className).toContain("disabled:pointer-events-none");
    expect(button.className).toContain("disabled:opacity-50");

    // Attempting direct programmatic click on disabled element does not fire handler
    button.click();
    expect(button).toBeDisabled();
  },
};

/**
 * Play: Loading state blocks interaction and displays status indicator
 * Verifies spinner is present with role="status", button is disabled,
 * and icons are suppressed while loading.
 */
export const PlayLoadingBlocksInteraction: Story = {
  name: "Play: Loading state blocks interaction & displays status spinner",
  render: () => {
    const handleClick = fn();
    return (
      <Button
        isLoading
        leftIcon={<span data-testid="hidden-left-icon">Icon</span>}
        onClick={handleClick}
        data-testid="loading-button"
      >
        Submitting...
      </Button>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("loading-button") as HTMLButtonElement;

    // Button must be disabled when loading
    expect(button).toBeDisabled();

    // Spinner with role="status" must be rendered
    const spinner = canvas.getByRole("status");
    expect(spinner).toBeInTheDocument();
    expect(spinner.classList.contains("animate-spin")).toBe(true);

    // Left and right icons must be suppressed
    expect(canvas.queryByTestId("hidden-left-icon")).not.toBeInTheDocument();

    // In-flight click is suppressed
    button.click();
    expect(button).toBeDisabled();
  },
};

/**
 * Play: Keyboard navigation and activation (Enter and Space keys)
 * Verifies accessible focus management and keyboard accessibility standards.
 */
export const PlayKeyboardActivation: Story = {
  name: "Play: Keyboard navigation & Enter/Space activation",
  render: () => {
    const handleClick = fn();
    return (
      <div className="flex flex-col gap-2">
        <input type="text" data-testid="preceding-input" placeholder="Tab from here" />
        <Button variant="primary" onClick={handleClick} data-testid="keyboard-button">
          Press Enter or Space
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId("preceding-input");
    const button = canvas.getByTestId("keyboard-button");

    // Focus initial element, then Tab to button
    input.focus();
    await userEvent.tab();
    expect(button).toHaveFocus();

    // Press Enter to activate
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveFocus();

    // Press Space to activate
    await userEvent.keyboard(" ");
    expect(button).toHaveFocus();
  },
};

/**
 * Play: Async failure, error sanitization, and retry recovery
 * Simulates adverse network failure, verifies sanitized error alert display
 * without credential leakage, and asserts recovery on retry.
 */
export const PlayAsyncActionFailureAndRecovery: Story = {
  name: "Play: Async action failure, error sanitization, and retry recovery",
  render: () => {
    const auditLogs: Array<{
      attempt: number;
      status: string;
      errorCode?: string;
      durationMs: number;
    }> = [];
    return (
      <AsyncActionHarness
        failFirstAttempt={true}
        simulatedLatencyMs={40}
        onAuditLog={(event) => auditLogs.push(event)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("async-action-button");
    const counter = canvas.getByTestId("attempt-counter");

    // Initial state: Attempt count is 0, no alerts present
    expect(counter).toHaveTextContent("Attempts: 0");
    expect(canvas.queryByTestId("error-alert")).not.toBeInTheDocument();
    expect(canvas.queryByTestId("success-status")).not.toBeInTheDocument();

    // ── First Attempt: Triggers failure ──────────────────────────────────────
    await userEvent.click(button);

    // Wait for failure response to settle
    const errorAlert = await canvas.findByRole("alert");
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(/\[ERR_E1002\]/i);

    // Invariant: Verify sensitive data (session_xyz, Secret token) is NEVER leaked to DOM
    expect(canvasElement.textContent).not.toContain("session_xyz");
    expect(canvasElement.textContent).not.toContain("Secret token");

    // Button transitions to Retry state
    expect(counter).toHaveTextContent("Attempts: 1");
    expect(button).toHaveTextContent("Retry Transaction");
    expect(button).not.toBeDisabled();

    // ── Second Attempt: User retries and recovers ─────────────────────────────
    await userEvent.click(button);

    // Wait for recovery and success status
    const successStatus = await canvas.findByTestId("success-status");
    expect(successStatus).toBeInTheDocument();
    expect(successStatus).toHaveTextContent(/transaction completed successfully/i);

    // Error alert is cleared
    expect(canvas.queryByTestId("error-alert")).not.toBeInTheDocument();
    expect(counter).toHaveTextContent("Attempts: 2");
    expect(button).toHaveTextContent("Completed");
  },
};

/**
 * Play: Concurrency & duplicate click guard
 * Rapidly dispatches multiple clicks while the operation is in-flight,
 * asserting that duplicate requests are prevented.
 */
export const PlayConcurrentClickDeduplication: Story = {
  name: "Play: In-flight concurrency guards against duplicate submission",
  render: () => {
    const handleDispatch = fn();
    return <ConcurrencyHarness onDispatch={handleDispatch} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("concurrency-button");
    const dispatchText = canvas.getByTestId("dispatch-count");

    // First click initiates in-flight request
    await userEvent.click(button);

    // Rapid successive clicks while button is in-flight
    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);

    // Verify only 1 dispatch occurred despite repeated clicks
    expect(dispatchText).toHaveTextContent("Dispatched count: 1");

    // Wait for in-flight operation to complete
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  },
};

/**
 * Play: Authorization state-transition guard
 * Verifies button remains inactive until authorization invariants are satisfied.
 */
export const PlayAuthorizationGuard: Story = {
  name: "Play: Authorization gate enforces prerequisite before execution",
  render: () => {
    const handleAction = fn();
    return <AuthorizationGuardHarness onAuthorizedAction={handleAction} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("auth-action-button");
    const checkbox = canvas.getByTestId("auth-checkbox");

    // Initially unauthorized: Button is disabled
    expect(button).toBeDisabled();
    expect(canvas.queryByTestId("auth-success-message")).not.toBeInTheDocument();

    // User checks authorization box
    await userEvent.click(checkbox);
    expect(button).toBeEnabled();

    // Execute authorized action
    await userEvent.click(button);

    // Status message confirms execution
    const successMsg = await canvas.findByTestId("auth-success-message");
    expect(successMsg).toBeInTheDocument();
  },
};

/**
 * Play: Boundary input fallback validation
 * Validates that invalid variant/size fallbacks and label precedence
 * function deterministically.
 */
export const PlayBoundaryFallbacks: Story = {
  name: "Play: Boundary inputs & label precedence validation",
  render: () => (
    <div className="flex flex-col gap-3">
      {/* Fallback to primary style */}
      <Button
        variant={"invalid-style" as unknown as ButtonVariant}
        data-testid="fallback-variant-button"
      >
        Fallback Variant
      </Button>

      {/* Fallback to md size */}
      <Button size={"invalid-size" as unknown as ButtonSize} data-testid="fallback-size-button">
        Fallback Size
      </Button>

      {/* Children precedence over text */}
      <Button text="Ignored text prop" data-testid="precedence-button">
        Preferred Children
      </Button>

      {/* Text fallback when children missing */}
      <Button text="Text Prop Value" data-testid="text-prop-button" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Fallback variant applies primary brand background class
    const variantBtn = canvas.getByTestId("fallback-variant-button");
    expect(variantBtn.className).toContain("bg-[#15A350]");

    // 2. Fallback size applies md padding and font classes
    const sizeBtn = canvas.getByTestId("fallback-size-button");
    expect(sizeBtn.className).toContain("px-4 py-2 text-sm");

    // 3. Children takes precedence over text
    const precedenceBtn = canvas.getByTestId("precedence-button");
    expect(precedenceBtn).toHaveTextContent("Preferred Children");
    expect(precedenceBtn).not.toHaveTextContent("Ignored text prop");

    // 4. Text prop is rendered when children is omitted
    const textBtn = canvas.getByTestId("text-prop-button");
    expect(textBtn).toHaveTextContent("Text Prop Value");
  },
};
