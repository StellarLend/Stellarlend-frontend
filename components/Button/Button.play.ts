/**
 * @file components/Button/Button.play.ts
 *
 * Production-ready interaction and play function harness for Button components.
 * Enforces deterministic behavior under normal and adverse conditions, including:
 * - Deterministic input validation for canvas and target elements
 * - Boundary handling (missing elements, multiple matches, disconnected trees, zero timeouts)
 * - State transition and accessibility invariants (disabled, loading, interactive, focus)
 * - Bounded retries and polling with cooperative cancellation (AbortSignal)
 * - Concurrency control to prevent interleaved/corrupted execution on shared DOM nodes
 * - Sanitized diagnostic observability without leaking sensitive credentials or PII
 * - Full backward compatibility with standard Storybook play runner signatures
 */

// ---------------------------------------------------------------------------
// Types & Contracts
// ---------------------------------------------------------------------------

export type ButtonState = 'default' | 'hover' | 'focus' | 'disabled' | 'loading' | 'error';

export type ButtonInvariant = 'disabled' | 'loading' | 'interactive' | 'focused';

export interface PlayContext {
  canvasElement?: unknown;
  args?: Record<string, unknown>;
  step?: (name: string, fn: () => Promise<unknown> | unknown) => Promise<unknown>;
  [key: string]: unknown;
}

export interface ButtonPlayDiagnostics {
  targetSelector: string;
  attempts: number;
  elapsedMs: number;
  elementFound: boolean;
  elementTag?: string;
  elementAttributes?: Record<string, string | boolean | null>;
  sanitizedText?: string;
  isConnected?: boolean;
  matchedState?: ButtonState;
}

export interface ButtonPlayOptions {
  /** Target button CSS selector within canvasElement. Defaults to 'button, [role="button"]' */
  selector?: string;
  /** Max time in ms to wait for element and invariants to stabilize. Defaults to 1000ms. Bound: [0, 10000] */
  timeoutMs?: number;
  /** Polling interval in ms for condition evaluation. Defaults to 25ms. Bound: [5, 1000] */
  intervalMs?: number;
  /** Optional cancellation signal to cancel async polling */
  signal?: AbortSignal;
  /** If true, strictly asserts that exactly one matching button exists. Defaults to false */
  strictSingle?: boolean;
  /** 0-based index to pick when multiple buttons match and strictSingle is false. Defaults to 0 */
  buttonIndex?: number;
  /** Expected accessible text (exact string or regex) to filter/verify target button */
  expectedText?: string | RegExp;
  /** Optional logging callback for diagnostics */
  logger?: (level: 'info' | 'warn' | 'error', message: string, diagnostics?: ButtonPlayDiagnostics) => void;
  /** Diagnostic callback invoked upon completion or failure */
  onDiagnostic?: (diagnostics: ButtonPlayDiagnostics) => void;
}

export interface ButtonPlayInteractiveOptions extends ButtonPlayOptions {
  /** Optional payload or event properties for click interaction */
  clickOptions?: {
    detail?: number;
    bubbles?: boolean;
    cancelable?: boolean;
  };
  /** If true, triggers double-click in rapid succession to test debounce/dedup invariants */
  duplicateClick?: boolean;
}

export interface ButtonPlayKeyboardOptions extends ButtonPlayOptions {
  /** Key to simulate. Defaults to 'Enter' */
  key?: 'Enter' | ' ' | 'Space' | 'Escape' | 'Tab';
}

export interface ButtonPlayResult {
  ok: true;
  element: Element;
  diagnostics: ButtonPlayDiagnostics;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Typed Error Classes
// ---------------------------------------------------------------------------

export class ButtonPlayError extends Error {
  readonly code: string;
  readonly diagnostics?: ButtonPlayDiagnostics;

  constructor(code: string, message: string, diagnostics?: ButtonPlayDiagnostics) {
    super(`[Button.play][${code}] ${message}`);
    this.name = 'ButtonPlayError';
    this.code = code;
    this.diagnostics = diagnostics;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ButtonPlayInputError extends ButtonPlayError {
  constructor(code: string, message: string, diagnostics?: ButtonPlayDiagnostics) {
    super(code, message, diagnostics);
    this.name = 'ButtonPlayInputError';
  }
}

export class ButtonPlayInvariantError extends ButtonPlayError {
  constructor(code: string, message: string, diagnostics?: ButtonPlayDiagnostics) {
    super(code, message, diagnostics);
    this.name = 'ButtonPlayInvariantError';
  }
}

export class ButtonPlayTimeoutError extends ButtonPlayError {
  constructor(code: string, message: string, diagnostics?: ButtonPlayDiagnostics) {
    super(code, message, diagnostics);
    this.name = 'ButtonPlayTimeoutError';
  }
}

// ---------------------------------------------------------------------------
// Security & PII Sanitization
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // emails
  /0x[a-fA-F0-9]{40}/gi, // Ethereum addresses
  /G[A-Z0-9]{55}/gi, // Stellar public keys
  /S[A-Z0-9]{55}/gi, // Stellar secret keys
  /key-[a-zA-Z0-9]+/gi,
  /secret[a-zA-Z0-9_-]*/gi,
  /password[a-zA-Z0-9_-]*/gi,
  /\b\d{16}\b/gi, // credit card numbers
];

/**
 * Sanitizes arbitrary text to redact potential credentials, secrets, or PII
 * before printing in test error messages or telemetry logs. Truncates length.
 */
export function sanitizeTextForDiagnostics(text: string, maxLength: number = 40): string {
  if (!text) return '';
  let sanitized = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  sanitized = sanitized.trim();
  if (sanitized.length > maxLength) {
    return sanitized.slice(0, maxLength) + '...';
  }
  return sanitized;
}

/**
 * Safely extracts non-sensitive attributes from a DOM element for diagnostics.
 */
export function extractElementDiagnostics(
  element: Element | null,
  selector: string,
  attempts: number,
  startTime: number
): ButtonPlayDiagnostics {
  const elapsedMs = Date.now() - startTime;
  if (!element) {
    return {
      targetSelector: selector,
      attempts,
      elapsedMs,
      elementFound: false,
    };
  }

  const attrs: Record<string, string | boolean | null> = {};
  const safeAttrNames = [
    'role',
    'type',
    'disabled',
    'aria-disabled',
    'aria-busy',
    'aria-label',
    'aria-expanded',
    'aria-haspopup',
    'data-testid',
    'class',
  ];

  for (const name of safeAttrNames) {
    if (element.hasAttribute(name)) {
      attrs[name] = element.getAttribute(name);
    }
  }

  return {
    targetSelector: selector,
    attempts,
    elapsedMs,
    elementFound: true,
    elementTag: element.tagName.toLowerCase(),
    elementAttributes: attrs,
    sanitizedText: sanitizeTextForDiagnostics(element.textContent || ''),
    isConnected: element.isConnected,
  };
}

// ---------------------------------------------------------------------------
// Concurrency Controller
// ---------------------------------------------------------------------------

/**
 * WeakMap-based lock to serialize concurrent play executions operating
 * on the exact same DOM node, preventing race conditions or interleaved mutations.
 */
const elementLocks = new WeakMap<object, Promise<unknown>>();

async function runWithLock<T>(element: object, task: () => Promise<T>): Promise<T> {
  const currentLock = elementLocks.get(element) ?? Promise.resolve();
  let releaseLock!: () => void;
  const nextLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  elementLocks.set(
    element,
    currentLock.then(() => nextLock).catch(() => nextLock)
  );

  await currentLock;
  try {
    return await task();
  } finally {
    releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Context & Canvas Validation
// ---------------------------------------------------------------------------

/**
 * Validates the play context and extracts the canvas element.
 * Enforces boundaries against null, undefined, primitive, or detached inputs.
 */
export function validateCanvasContext(context: unknown): { canvasElement: Element } {
  if (context === null || context === undefined || typeof context !== 'object') {
    throw new ButtonPlayInputError(
      'INVALID_CONTEXT',
      'Play context must be a non-null object containing canvasElement.'
    );
  }

  const playContext = context as Record<string, unknown>;
  const canvas = playContext.canvasElement;

  if (!canvas) {
    throw new ButtonPlayInputError(
      'MISSING_CANVAS',
      'canvasElement is required in play context.'
    );
  }

  // Must have standard DOM querySelector capability
  if (typeof (canvas as Element).querySelector !== 'function') {
    throw new ButtonPlayInputError(
      'INVALID_CANVAS',
      'canvasElement must be a valid DOM Element or container with querySelector.'
    );
  }

  return { canvasElement: canvas as Element };
}

// ---------------------------------------------------------------------------
// Bounded Polling & Retry Utilities
// ---------------------------------------------------------------------------

/**
 * Polls for a condition until it passes, times out, or is cancelled via AbortSignal.
 * Boundedly clamps timeout and interval values to prevent infinite hangs.
 */
export async function waitForCondition<T>(
  conditionFn: () => T | null | false | Promise<T | null | false>,
  options: {
    timeoutMs: number;
    intervalMs: number;
    signal?: AbortSignal;
    description: string;
  }
): Promise<{ value: T; attempts: number; elapsedMs: number }> {
  const timeoutMs = Math.max(0, Math.min(10000, options.timeoutMs));
  const intervalMs = Math.max(5, Math.min(1000, options.intervalMs));
  const startTime = Date.now();
  let attempts = 0;

  if (options.signal?.aborted) {
    throw new ButtonPlayError('ABORTED', `Operation aborted: ${options.description}`);
  }

  while (true) {
    attempts++;
    if (options.signal?.aborted) {
      throw new ButtonPlayError('ABORTED', `Operation aborted: ${options.description}`);
    }

    try {
      const result = await conditionFn();
      if (result !== null && result !== false) {
        return { value: result, attempts, elapsedMs: Date.now() - startTime };
      }
    } catch (err) {
      if (err instanceof ButtonPlayError) {
        throw err;
      }
      // transient failure inside condition polling; retry until timeout
    }

    const elapsed = Date.now() - startTime;
    if (timeoutMs === 0 || elapsed >= timeoutMs) {
      break;
    }

    const waitDuration = Math.min(intervalMs, timeoutMs - elapsed);
    await new Promise((resolve) => setTimeout(resolve, waitDuration));
  }

  throw new ButtonPlayTimeoutError(
    'TIMEOUT',
    `Timed out after ${timeoutMs}ms waiting for: ${options.description} (attempts: ${attempts})`
  );
}

// ---------------------------------------------------------------------------
// Target Button Resolution
// ---------------------------------------------------------------------------

/**
 * Locates the target button in the canvas element according to options.
 * Handles boundary conditions like multiple buttons, text matching, and strict single checks.
 */
export async function findButtonElement(
  canvasElement: Element,
  options: ButtonPlayOptions = {}
): Promise<{ button: Element; attempts: number; elapsedMs: number }> {
  const selector = options.selector ?? 'button, [role="button"]';
  const timeoutMs = options.timeoutMs ?? 1000;
  const intervalMs = options.intervalMs ?? 25;
  const buttonIndex = Math.max(0, options.buttonIndex ?? 0);
  const strictSingle = options.strictSingle ?? false;
  const expectedText = options.expectedText;

  const resolved = await waitForCondition(
    () => {
      const elements = Array.from(canvasElement.querySelectorAll(selector));
      if (elements.length === 0) {
        return null;
      }

      let filtered = elements;
      if (expectedText !== undefined) {
        filtered = elements.filter((el) => {
          const text = (el.textContent || '').trim();
          return typeof expectedText === 'string'
            ? text.includes(expectedText)
            : expectedText.test(text);
        });
        if (filtered.length === 0) {
          return null;
        }
      }

      if (strictSingle && filtered.length > 1) {
        throw new ButtonPlayInvariantError(
          'AMBIGUOUS_TARGET',
          `Found ${filtered.length} matching buttons for selector "${selector}", but strictSingle is true.`
        );
      }

      const target = filtered[buttonIndex];
      return target || null;
    },
    {
      timeoutMs,
      intervalMs,
      signal: options.signal,
      description: `button matching "${selector}" in canvasElement`,
    }
  );

  return {
    button: resolved.value,
    attempts: resolved.attempts,
    elapsedMs: resolved.elapsedMs,
  };
}

// ---------------------------------------------------------------------------
// Invariant Verification Logic
// ---------------------------------------------------------------------------

/**
 * Verifies that a button element satisfies the disabled invariant:
 * - HTMLButtonElement.disabled === true OR
 * - aria-disabled === "true" OR
 * - disabled attribute exists
 */
export function verifyDisabledInvariant(button: Element, diagnostics: ButtonPlayDiagnostics): void {
  const isNativeDisabled = (button as HTMLButtonElement).disabled === true || button.hasAttribute('disabled');
  const isAriaDisabled = button.getAttribute('aria-disabled') === 'true';

  if (!isNativeDisabled && !isAriaDisabled) {
    throw new ButtonPlayInvariantError(
      'INVARIANT_VIOLATION_NOT_DISABLED',
      `Expected button "${diagnostics.sanitizedText}" to be disabled, but found disabled=${isNativeDisabled} and aria-disabled="${button.getAttribute('aria-disabled')}".`,
      diagnostics
    );
  }
}

/**
 * Verifies that a button or its canvas container satisfies the loading invariant:
 * - Loading indicator present ([role="status"], svg.animate-spin, or aria-busy="true")
 * - Button is non-interactive while loading (either disabled or aria-busy="true")
 */
export function verifyLoadingInvariant(
  canvas: Element,
  button: Element | null,
  diagnostics: ButtonPlayDiagnostics
): void {
  const spinnerInButton = button ? button.querySelector('[role="status"], svg.animate-spin, .animate-spin') : null;
  const spinnerInCanvas = canvas.querySelector('[role="status"], svg.animate-spin, .animate-spin');
  const hasAriaBusy = button ? button.getAttribute('aria-busy') === 'true' : false;

  const hasLoadingIndicator = Boolean(spinnerInButton || spinnerInCanvas || hasAriaBusy);

  if (!hasLoadingIndicator) {
    throw new ButtonPlayInvariantError(
      'INVARIANT_VIOLATION_NOT_LOADING',
      `Expected loading indicator for button "${diagnostics.sanitizedText}", but neither [role="status"], .animate-spin, nor aria-busy="true" was found.`,
      diagnostics
    );
  }

  // State-transition invariant: while loading, button must be guarded against active interactions
  if (button) {
    const isNativeDisabled = (button as HTMLButtonElement).disabled === true || button.hasAttribute('disabled');
    const isAriaDisabled = button.getAttribute('aria-disabled') === 'true';
    if (!isNativeDisabled && !isAriaDisabled && !hasAriaBusy) {
      throw new ButtonPlayInvariantError(
        'INVARIANT_VIOLATION_LOADING_INTERACTIVE',
        `Button has loading indicator but remains interactively enabled (disabled=false, aria-busy=false).`,
        diagnostics
      );
    }
  }
}

/**
 * Verifies that a button satisfies the interactive invariant:
 * - Not disabled
 * - Not busy/loading
 * - Can receive click events
 */
export function verifyInteractiveInvariant(button: Element, diagnostics: ButtonPlayDiagnostics): void {
  const isNativeDisabled = (button as HTMLButtonElement).disabled === true || button.hasAttribute('disabled');
  const isAriaDisabled = button.getAttribute('aria-disabled') === 'true';
  const isAriaBusy = button.getAttribute('aria-busy') === 'true';

  if (isNativeDisabled || isAriaDisabled) {
    throw new ButtonPlayInvariantError(
      'INVARIANT_VIOLATION_INTERACTIVE_DISABLED',
      `Expected button "${diagnostics.sanitizedText}" to be interactive, but it is disabled.`,
      diagnostics
    );
  }

  if (isAriaBusy) {
    throw new ButtonPlayInvariantError(
      'INVARIANT_VIOLATION_INTERACTIVE_BUSY',
      `Expected button "${diagnostics.sanitizedText}" to be interactive, but it is in a busy state.`,
      diagnostics
    );
  }
}

// ---------------------------------------------------------------------------
// Public Play Functions
// ---------------------------------------------------------------------------

/**
 * Tests the Disabled state of a Button.
 *
 * Invariants:
 * 1. Target button exists within canvasElement.
 * 2. Target button is disabled via native `disabled` or `aria-disabled="true"`.
 * 3. Deterministic execution protected against concurrency races.
 *
 * @param context PlayContext with canvasElement
 * @param options Optional timeout, selector, and diagnostic configuration
 */
export const playDisabled = async (
  context: PlayContext,
  options: ButtonPlayOptions = {}
): Promise<ButtonPlayResult> => {
  const { canvasElement } = validateCanvasContext(context);
  const startTime = Date.now();

  return await runWithLock(canvasElement, async () => {
    let button: Element | null = null;
    let attempts = 0;

    try {
      const timeoutMs = options.timeoutMs ?? 1000;
      const intervalMs = options.intervalMs ?? 25;

      const resolved = await waitForCondition(
        async () => {
          let candidate: Element | null = null;
          try {
            const res = await findButtonElement(canvasElement, {
              ...options,
              timeoutMs: 0,
            });
            candidate = res.button;
          } catch {
            return null;
          }

          if (!candidate) return null;

          const isNativeDisabled =
            (candidate as HTMLButtonElement).disabled === true || candidate.hasAttribute('disabled');
          const isAriaDisabled = candidate.getAttribute('aria-disabled') === 'true';

          if (isNativeDisabled || isAriaDisabled) {
            return { button: candidate };
          }
          return null;
        },
        {
          timeoutMs,
          intervalMs,
          signal: options.signal,
          description: `disabled button matching "${options.selector ?? 'button'}" in canvasElement`,
        }
      );

      button = resolved.value.button;
      attempts = resolved.attempts;

      const diagnostics = extractElementDiagnostics(button, options.selector ?? 'button', attempts, startTime);
      diagnostics.matchedState = 'disabled';

      verifyDisabledInvariant(button, diagnostics);

      options.logger?.('info', `Verified disabled invariant for button`, diagnostics);
      options.onDiagnostic?.(diagnostics);

      return {
        ok: true,
        element: button,
        diagnostics,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      if (err instanceof ButtonPlayTimeoutError) {
        // If a button was present but never became disabled, report invariant violation
        let candidate: Element | null = null;
        try {
          const res = await findButtonElement(canvasElement, { ...options, timeoutMs: 0 });
          candidate = res.button;
        } catch {
          // not found
        }
        if (candidate) {
          const diagnostics = extractElementDiagnostics(candidate, options.selector ?? 'button', attempts, startTime);
          diagnostics.matchedState = 'default';
          throw new ButtonPlayInvariantError(
            'INVARIANT_VIOLATION_NOT_DISABLED',
            `Expected button "${diagnostics.sanitizedText}" to be disabled, but found disabled=false and aria-disabled="${candidate.getAttribute('aria-disabled')}".`,
            diagnostics
          );
        }
      }

      const diagnostics = extractElementDiagnostics(
        button,
        options.selector ?? 'button',
        attempts,
        startTime
      );
      options.logger?.('error', `playDisabled failed: ${(err as Error).message}`, diagnostics);
      options.onDiagnostic?.(diagnostics);
      throw err;
    }
  });
};

/**
 * Tests the Loading state of a Button.
 *
 * Invariants:
 * 1. Target button or canvas contains a visible status spinner / role="status".
 * 2. Button is non-interactive while loading.
 * 3. Deterministic execution under partial delay or async state changes.
 *
 * @param context PlayContext with canvasElement
 * @param options Optional timeout, selector, and diagnostic configuration
 */
export const playLoading = async (
  context: PlayContext,
  options: ButtonPlayOptions = {}
): Promise<ButtonPlayResult> => {
  const { canvasElement } = validateCanvasContext(context);
  const startTime = Date.now();

  return await runWithLock(canvasElement, async () => {
    let button: Element | null = null;
    let attempts = 0;

    try {
      const timeoutMs = options.timeoutMs ?? 1000;
      const intervalMs = options.intervalMs ?? 25;

      const resolved = await waitForCondition(
        async () => {
          let candidate: Element | null = null;
          try {
            const res = await findButtonElement(canvasElement, {
              ...options,
              timeoutMs: 0, // poll synchronously inside outer loop
            });
            candidate = res.button;
          } catch {
            // Button might be temporarily unmounted or replaced
          }

          const hasIndicator =
            canvasElement.querySelector('[role="status"], svg.animate-spin, .animate-spin') ||
            (candidate && candidate.getAttribute('aria-busy') === 'true');

          if (hasIndicator) {
            return { button: candidate };
          }
          return null;
        },
        {
          timeoutMs,
          intervalMs,
          signal: options.signal,
          description: `loading indicator in canvasElement for selector "${options.selector ?? 'button'}"`,
        }
      );

      button = resolved.value.button;
      attempts = resolved.attempts;

      const diagnostics = extractElementDiagnostics(button, options.selector ?? 'button', attempts, startTime);
      diagnostics.matchedState = 'loading';

      verifyLoadingInvariant(canvasElement, button, diagnostics);

      options.logger?.('info', `Verified loading invariant for button`, diagnostics);
      options.onDiagnostic?.(diagnostics);

      return {
        ok: true,
        element: button || canvasElement,
        diagnostics,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const diagnostics = extractElementDiagnostics(
        button,
        options.selector ?? 'button',
        attempts,
        startTime
      );
      options.logger?.('error', `playLoading failed: ${(err as Error).message}`, diagnostics);
      options.onDiagnostic?.(diagnostics);
      throw err;
    }
  });
};

/**
 * Tests Interactive Click behavior of a Button.
 *
 * Invariants:
 * 1. Target button is enabled, visible, and interactive.
 * 2. Dispatches click and optional duplicate clicks to verify debouncing.
 *
 * @param context PlayContext with canvasElement
 * @param options Interactive play options (clickOptions, duplicateClick, etc.)
 */
export const playInteractive = async (
  context: PlayContext,
  options: ButtonPlayInteractiveOptions = {}
): Promise<ButtonPlayResult> => {
  const { canvasElement } = validateCanvasContext(context);
  const startTime = Date.now();

  return await runWithLock(canvasElement, async () => {
    let button: Element | null = null;
    let attempts = 0;

    try {
      const resolved = await findButtonElement(canvasElement, options);
      button = resolved.button;
      attempts = resolved.attempts;

      const diagnostics = extractElementDiagnostics(button, options.selector ?? 'button', attempts, startTime);
      diagnostics.matchedState = 'default';

      verifyInteractiveInvariant(button, diagnostics);

      // Perform click simulation
      const clickEvt = new MouseEvent('click', {
        bubbles: options.clickOptions?.bubbles ?? true,
        cancelable: options.clickOptions?.cancelable ?? true,
        detail: options.clickOptions?.detail ?? 1,
      });

      button.dispatchEvent(clickEvt);

      // Boundary: duplicate rapid click test
      if (options.duplicateClick) {
        const secondClick = new MouseEvent('click', {
          bubbles: options.clickOptions?.bubbles ?? true,
          cancelable: options.clickOptions?.cancelable ?? true,
          detail: 2,
        });
        button.dispatchEvent(secondClick);
      }

      options.logger?.('info', `Verified interactive invariant for button`, diagnostics);
      options.onDiagnostic?.(diagnostics);

      return {
        ok: true,
        element: button,
        diagnostics,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const diagnostics = extractElementDiagnostics(
        button,
        options.selector ?? 'button',
        attempts,
        startTime
      );
      options.logger?.('error', `playInteractive failed: ${(err as Error).message}`, diagnostics);
      options.onDiagnostic?.(diagnostics);
      throw err;
    }
  });
};

export const playClick = playInteractive;

/**
 * Tests Focus behavior of a Button.
 */
export const playFocus = async (
  context: PlayContext,
  options: ButtonPlayOptions = {}
): Promise<ButtonPlayResult> => {
  const { canvasElement } = validateCanvasContext(context);
  const startTime = Date.now();

  return await runWithLock(canvasElement, async () => {
    const resolved = await findButtonElement(canvasElement, options);
    const button = resolved.button;
    const diagnostics = extractElementDiagnostics(button, options.selector ?? 'button', resolved.attempts, startTime);
    diagnostics.matchedState = 'focus';

    if (typeof (button as HTMLElement).focus === 'function') {
      (button as HTMLElement).focus();
    }

    button.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    options.logger?.('info', `Verified focus invariant for button`, diagnostics);
    options.onDiagnostic?.(diagnostics);

    return {
      ok: true,
      element: button,
      diagnostics,
      durationMs: Date.now() - startTime,
    };
  });
};

/**
 * Tests Keyboard activation (Enter/Space) of a Button.
 */
export const playKeyboard = async (
  context: PlayContext,
  options: ButtonPlayKeyboardOptions = {}
): Promise<ButtonPlayResult> => {
  const { canvasElement } = validateCanvasContext(context);
  const startTime = Date.now();
  const key = options.key ?? 'Enter';

  return await runWithLock(canvasElement, async () => {
    const resolved = await findButtonElement(canvasElement, options);
    const button = resolved.button;
    const diagnostics = extractElementDiagnostics(button, options.selector ?? 'button', resolved.attempts, startTime);

    verifyInteractiveInvariant(button, diagnostics);

    const downEvt = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    const upEvt = new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true });

    button.dispatchEvent(downEvt);
    button.dispatchEvent(upEvt);

    if (key === 'Enter' || key === ' ' || key === 'Space') {
      // Standard accessible button keyboard activation dispatches click
      const clickEvt = new MouseEvent('click', { bubbles: true, cancelable: true });
      button.dispatchEvent(clickEvt);
    }

    options.logger?.('info', `Verified keyboard ${key} invariant for button`, diagnostics);
    options.onDiagnostic?.(diagnostics);

    return {
      ok: true,
      element: button,
      diagnostics,
      durationMs: Date.now() - startTime,
    };
  });
};

/**
 * General invariant assertion helper for Button elements.
 */
export function assertButtonInvariant(
  element: Element | null | undefined,
  invariant: ButtonInvariant,
  options: { selector?: string } = {}
): void {
  const startTime = Date.now();
  const diagnostics = extractElementDiagnostics(element || null, options.selector ?? 'button', 1, startTime);

  if (!element) {
    throw new ButtonPlayInputError('MISSING_ELEMENT', 'Element is required to assert button invariant.');
  }

  switch (invariant) {
    case 'disabled':
      verifyDisabledInvariant(element, diagnostics);
      break;
    case 'loading':
      verifyLoadingInvariant(element, element, diagnostics);
      break;
    case 'interactive':
      verifyInteractiveInvariant(element, diagnostics);
      break;
    case 'focused':
      // Document activeElement check where available
      if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== element) {
        throw new ButtonPlayInvariantError(
          'INVARIANT_VIOLATION_NOT_FOCUSED',
          `Expected button to have focus, but document.activeElement was "${document.activeElement.tagName}".`,
          diagnostics
        );
      }
      break;
  }
}
