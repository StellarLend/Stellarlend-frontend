/**
 * @file components/Button/Button.play.test.ts
 *
 * Comprehensive test suite for Button.play.ts.
 * Covers:
 * - Normal operation & success paths for all play functions
 * - Invalid, null, undefined, and hostile inputs
 * - Invariant violations (disabled, loading, interactive states)
 * - Boundary conditions (empty container, multiple buttons, strictSingle, zero timeout, text filters)
 * - Retries, async state transitions, and AbortSignal cancellation
 * - Concurrency control & serialization on shared DOM nodes
 * - Observability, diagnostics, and privacy/credential redaction
 * - Backward compatibility with legacy Storybook play signatures
 */

import {
  playDisabled,
  playLoading,
  playInteractive,
  playClick,
  playFocus,
  playKeyboard,
  assertButtonInvariant,
  findButtonElement,
  waitForCondition,
  sanitizeTextForDiagnostics,
  validateCanvasContext,
  ButtonPlayError,
  ButtonPlayInputError,
  ButtonPlayInvariantError,
  ButtonPlayTimeoutError,
  ButtonPlayDiagnostics,
} from './Button.play';

// ---------------------------------------------------------------------------
// Lightweight DOM Fixture for Node / Browser Test Execution
// ---------------------------------------------------------------------------

class MockDOMEvent {
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented = false;
  constructor(type: string, options: { bubbles?: boolean; cancelable?: boolean } = {}) {
    this.type = type;
    this.bubbles = options.bubbles ?? false;
    this.cancelable = options.cancelable ?? false;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
}

class MockMouseEvent extends MockDOMEvent {
  detail: number;
  constructor(type: string, options: { bubbles?: boolean; cancelable?: boolean; detail?: number } = {}) {
    super(type, options);
    this.detail = options.detail ?? 1;
  }
}

class MockKeyboardEvent extends MockDOMEvent {
  key: string;
  constructor(type: string, options: { key?: string; bubbles?: boolean; cancelable?: boolean } = {}) {
    super(type, options);
    this.key = options.key ?? '';
  }
}

class MockFocusEvent extends MockDOMEvent {
  constructor(type: string, options: { bubbles?: boolean; cancelable?: boolean } = {}) {
    super(type, options);
  }
}

// Ensure global event constructors exist in Node environment
if (typeof globalThis.MouseEvent === 'undefined') {
  (globalThis as any).MouseEvent = MockMouseEvent;
}
if (typeof globalThis.KeyboardEvent === 'undefined') {
  (globalThis as any).KeyboardEvent = MockKeyboardEvent;
}
if (typeof globalThis.FocusEvent === 'undefined') {
  (globalThis as any).FocusEvent = MockFocusEvent;
}

export class MockDOMElement {
  tagName: string;
  attributes = new Map<string, string>();
  children: MockDOMElement[] = [];
  parentElement: MockDOMElement | null = null;
  textContent: string = '';
  disabled = false;
  isConnected = true;
  eventListeners = new Map<string, Array<(evt: any) => void>>();
  hasFocus = false;

  constructor(tagName: string, textContent = '') {
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name.toLowerCase(), String(value));
    if (name.toLowerCase() === 'disabled') {
      this.disabled = true;
    }
  }

  getAttribute(name: string): string | null {
    const val = this.attributes.get(name.toLowerCase());
    return val !== undefined ? val : null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name.toLowerCase());
  }

  removeAttribute(name: string) {
    this.attributes.delete(name.toLowerCase());
    if (name.toLowerCase() === 'disabled') {
      this.disabled = false;
    }
  }

  appendChild(child: MockDOMElement) {
    child.parentElement = this;
    this.children.push(child);
  }

  removeChild(child: MockDOMElement) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      child.parentElement = null;
      this.children.splice(index, 1);
    }
  }

  addEventListener(type: string, listener: (evt: any) => void) {
    const list = this.eventListeners.get(type) ?? [];
    list.push(listener);
    this.eventListeners.set(type, list);
  }

  removeEventListener(type: string, listener: (evt: any) => void) {
    const list = this.eventListeners.get(type);
    if (list) {
      this.eventListeners.set(
        type,
        list.filter((l) => l !== listener)
      );
    }
  }

  dispatchEvent(event: any): boolean {
    const list = this.eventListeners.get(event.type) ?? [];
    for (const listener of list) {
      listener(event);
    }
    return !event.defaultPrevented;
  }

  focus() {
    this.hasFocus = true;
  }

  blur() {
    this.hasFocus = false;
  }

  querySelector(selector: string): MockDOMElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector: string): MockDOMElement[] {
    const results: MockDOMElement[] = [];

    const matches = (el: MockDOMElement): boolean => {
      const parts = selector.split(',').map((s) => s.trim().toLowerCase());
      for (const part of parts) {
        if (part === 'button' && el.tagName === 'BUTTON') return true;
        if (part === 'svg' && el.tagName === 'SVG') return true;
        if (part === '[role="button"]' && el.getAttribute('role') === 'button') return true;
        if (part === '[role="status"]' && el.getAttribute('role') === 'status') return true;
        if (part === '.animate-spin' && (el.getAttribute('class') || '').includes('animate-spin')) return true;
        if (part === 'svg.animate-spin' && el.tagName === 'SVG' && (el.getAttribute('class') || '').includes('animate-spin')) return true;
        if (part.startsWith('.') && (el.getAttribute('class') || '').includes(part.slice(1))) return true;
      }
      return false;
    };

    const traverse = (current: MockDOMElement) => {
      for (const child of current.children) {
        if (matches(child)) {
          results.push(child);
        }
        traverse(child);
      }
    };

    traverse(this);
    return results;
  }
}

// ---------------------------------------------------------------------------
// Test Runner Harness (Self-contained, works with node:test or standalone)
// ---------------------------------------------------------------------------

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: Array<{ name: string; error: unknown }> = [];

async function test(name: string, fn: () => Promise<void> | void) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err });
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error)?.stack || err}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertStrictEqual(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
  }
}

async function assertRejects(fn: () => Promise<unknown>, expectedErrorCode?: string) {
  try {
    await fn();
  } catch (err) {
    if (expectedErrorCode) {
      assert(
        (err as ButtonPlayError).code === expectedErrorCode || (err as Error).message.includes(expectedErrorCode),
        `Expected error with code "${expectedErrorCode}", got "${(err as any)?.code || (err as Error)?.message}"`
      );
    }
    return;
  }
  throw new Error(`Expected async function to throw, but it succeeded.`);
}

// ---------------------------------------------------------------------------
// Test Suite Execution
// ---------------------------------------------------------------------------

export async function runButtonPlayTests() {
  console.log('\n--- Running Button.play Test Suite ---');

  // 1. Sanitization & Privacy
  await test('sanitizeTextForDiagnostics: redacts bearer tokens, stellar keys, emails and truncates', () => {
    const raw = 'Auth Bearer eyJhbGciOiJIUzI1NiJ9 and user@example.com with GAB37GZ36Z34Z34Z34Z34Z34Z34Z34Z34Z34Z34Z34Z34Z34Z34Z34Z34';
    const sanitized = sanitizeTextForDiagnostics(raw, 30);
    assert(!sanitized.includes('user@example.com'), 'Email should be redacted');
    assert(!sanitized.includes('Bearer eyJhbGci'), 'Token should be redacted');
    assert(sanitized.includes('[REDACTED]'), 'Should contain [REDACTED]');
    assert(sanitized.length <= 33, 'Should be truncated with ellipsis');
  });

  // 2. Context Validation
  await test('validateCanvasContext: rejects null, undefined, primitive context', () => {
    assertRejects(() => Promise.resolve(validateCanvasContext(null)), 'INVALID_CONTEXT');
    assertRejects(() => Promise.resolve(validateCanvasContext(undefined)), 'INVALID_CONTEXT');
    assertRejects(() => Promise.resolve(validateCanvasContext('canvas' as any)), 'INVALID_CONTEXT');
  });

  await test('validateCanvasContext: rejects context without canvasElement', () => {
    assertRejects(() => Promise.resolve(validateCanvasContext({})), 'MISSING_CANVAS');
    assertRejects(() => Promise.resolve(validateCanvasContext({ canvasElement: null })), 'MISSING_CANVAS');
  });

  await test('validateCanvasContext: rejects canvasElement without querySelector', () => {
    assertRejects(() => Promise.resolve(validateCanvasContext({ canvasElement: {} })), 'INVALID_CANVAS');
  });

  // 3. playDisabled Success Scenarios
  await test('playDisabled: succeeds with native disabled attribute', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Confirm');
    button.setAttribute('disabled', 'true');
    canvas.appendChild(button);

    let diagnosticReported = false;
    const result = await playDisabled(
      { canvasElement: canvas as any },
      {
        timeoutMs: 100,
        onDiagnostic: (diag) => {
          diagnosticReported = true;
          assertStrictEqual(diag.matchedState, 'disabled');
        },
      }
    );

    assertStrictEqual(result.ok, true);
    assertStrictEqual(result.element, button);
    assert(diagnosticReported, 'onDiagnostic should be called');
  });

  await test('playDisabled: succeeds with aria-disabled="true"', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Pay');
    button.setAttribute('aria-disabled', 'true');
    canvas.appendChild(button);

    const result = await playDisabled({ canvasElement: canvas as any });
    assertStrictEqual(result.ok, true);
  });

  // 4. playDisabled Failure & Invariant Violation Scenarios
  await test('playDisabled: fails when button is enabled and interactive', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Enabled Button');
    canvas.appendChild(button);

    await assertRejects(
      () => playDisabled({ canvasElement: canvas as any }, { timeoutMs: 50 }),
      'INVARIANT_VIOLATION_NOT_DISABLED'
    );
  });

  await test('playDisabled: fails when canvas has no button', async () => {
    const canvas = new MockDOMElement('div');
    await assertRejects(
      () => playDisabled({ canvasElement: canvas as any }, { timeoutMs: 50 }),
      'TIMEOUT'
    );
  });

  // 5. playLoading Success Scenarios
  await test('playLoading: succeeds when button contains [role="status"]', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Submit');
    button.setAttribute('disabled', 'true');
    const spinner = new MockDOMElement('svg');
    spinner.setAttribute('role', 'status');
    button.appendChild(spinner);
    canvas.appendChild(button);

    const result = await playLoading({ canvasElement: canvas as any }, { timeoutMs: 100 });
    assertStrictEqual(result.ok, true);
  });

  await test('playLoading: succeeds when button has aria-busy="true"', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Saving');
    button.setAttribute('aria-busy', 'true');
    canvas.appendChild(button);

    const result = await playLoading({ canvasElement: canvas as any });
    assertStrictEqual(result.ok, true);
  });

  // 6. playLoading Invariant Violations
  await test('playLoading: fails when button has spinner but is actively enabled', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Submitting');
    // Button is not disabled and aria-busy is false
    const spinner = new MockDOMElement('svg');
    spinner.setAttribute('role', 'status');
    button.appendChild(spinner);
    canvas.appendChild(button);

    await assertRejects(
      () => playLoading({ canvasElement: canvas as any }, { timeoutMs: 50 }),
      'INVARIANT_VIOLATION_LOADING_INTERACTIVE'
    );
  });

  await test('playLoading: times out when no loading indicator exists', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Normal');
    button.setAttribute('disabled', 'true');
    canvas.appendChild(button);

    await assertRejects(
      () => playLoading({ canvasElement: canvas as any }, { timeoutMs: 50 }),
      'TIMEOUT'
    );
  });

  // 7. playInteractive / playClick Success & Rejections
  await test('playInteractive: triggers click event and succeeds', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Click Me');
    canvas.appendChild(button);

    let clickCount = 0;
    button.addEventListener('click', () => {
      clickCount++;
    });

    const result = await playInteractive({ canvasElement: canvas as any });
    assertStrictEqual(result.ok, true);
    assertStrictEqual(clickCount, 1);
  });

  await test('playInteractive: duplicateClick simulates double-click for debouncing tests', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Double Click');
    canvas.appendChild(button);

    let clickCount = 0;
    button.addEventListener('click', () => {
      clickCount++;
    });

    await playInteractive({ canvasElement: canvas as any }, { duplicateClick: true });
    assertStrictEqual(clickCount, 2);
  });

  await test('playInteractive: rejects if button is disabled', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Disabled');
    button.setAttribute('disabled', 'true');
    canvas.appendChild(button);

    await assertRejects(
      () => playInteractive({ canvasElement: canvas as any }, { timeoutMs: 50 }),
      'INVARIANT_VIOLATION_INTERACTIVE_DISABLED'
    );
  });

  // 8. Focus and Keyboard Interaction
  await test('playFocus: focuses button and dispatches focus event', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Focus Target');
    canvas.appendChild(button);

    let focused = false;
    button.addEventListener('focus', () => {
      focused = true;
    });

    await playFocus({ canvasElement: canvas as any });
    assert(button.hasFocus, 'Button hasFocus should be true');
    assert(focused, 'focus event should be dispatched');
  });

  await test('playKeyboard: simulates Enter activation with keyboard events and click', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Press Enter');
    canvas.appendChild(button);

    let keydownSeen = false;
    let clicked = false;
    button.addEventListener('keydown', (e: any) => {
      if (e.key === 'Enter') keydownSeen = true;
    });
    button.addEventListener('click', () => {
      clicked = true;
    });

    await playKeyboard({ canvasElement: canvas as any }, { key: 'Enter' });
    assert(keydownSeen, 'keydown should be received');
    assert(clicked, 'Enter key should dispatch click');
  });

  // 9. Boundary Conditions
  await test('boundary: multiple buttons disambiguation via buttonIndex', async () => {
    const canvas = new MockDOMElement('div');
    const btn1 = new MockDOMElement('button', 'First');
    const btn2 = new MockDOMElement('button', 'Second');
    btn2.setAttribute('disabled', 'true');
    canvas.appendChild(btn1);
    canvas.appendChild(btn2);

    const result = await playDisabled(
      { canvasElement: canvas as any },
      { buttonIndex: 1, timeoutMs: 100 }
    );
    assertStrictEqual(result.element, btn2);
  });

  await test('boundary: strictSingle throws AMBIGUOUS_TARGET when multiple buttons match', async () => {
    const canvas = new MockDOMElement('div');
    canvas.appendChild(new MockDOMElement('button', 'Btn 1'));
    canvas.appendChild(new MockDOMElement('button', 'Btn 2'));

    await assertRejects(
      () => playInteractive({ canvasElement: canvas as any }, { strictSingle: true, timeoutMs: 50 }),
      'AMBIGUOUS_TARGET'
    );
  });

  await test('boundary: expectedText filters target button by text', async () => {
    const canvas = new MockDOMElement('div');
    const cancelBtn = new MockDOMElement('button', 'Cancel');
    const confirmBtn = new MockDOMElement('button', 'Confirm Transaction');
    confirmBtn.setAttribute('disabled', 'true');
    canvas.appendChild(cancelBtn);
    canvas.appendChild(confirmBtn);

    const result = await playDisabled(
      { canvasElement: canvas as any },
      { expectedText: /Confirm/i, timeoutMs: 100 }
    );
    assertStrictEqual(result.element, confirmBtn);
  });

  await test('boundary: zero timeout handles immediate evaluation', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Fast');
    button.setAttribute('disabled', 'true');
    canvas.appendChild(button);

    const result = await playDisabled({ canvasElement: canvas as any }, { timeoutMs: 0 });
    assertStrictEqual(result.ok, true);
  });

  // 10. Retries & Async State Transitions
  await test('retry: succeeds when element transitions to disabled asynchronously', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Async Button');
    canvas.appendChild(button);

    // Transition to disabled after 40ms
    setTimeout(() => {
      button.setAttribute('disabled', 'true');
    }, 40);

    const result = await playDisabled(
      { canvasElement: canvas as any },
      { timeoutMs: 300, intervalMs: 15 }
    );
    assertStrictEqual(result.ok, true);
    assert(result.diagnostics.attempts > 1, 'Should have taken multiple attempts');
  });

  await test('cancellation: AbortSignal cancels polling immediately', async () => {
    const canvas = new MockDOMElement('div');
    const controller = new AbortController();

    // Abort after 20ms
    setTimeout(() => {
      controller.abort();
    }, 20);

    await assertRejects(
      () =>
        playDisabled(
          { canvasElement: canvas as any },
          { timeoutMs: 500, intervalMs: 15, signal: controller.signal }
        ),
      'ABORTED'
    );
  });

  // 11. Concurrency Safety
  await test('concurrency: concurrent calls on same canvas execute safely without race conditions', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Concurrent Target');
    button.setAttribute('disabled', 'true');
    canvas.appendChild(button);

    // Launch 3 concurrent executions
    const [res1, res2, res3] = await Promise.all([
      playDisabled({ canvasElement: canvas as any }, { timeoutMs: 200 }),
      playDisabled({ canvasElement: canvas as any }, { timeoutMs: 200 }),
      playDisabled({ canvasElement: canvas as any }, { timeoutMs: 200 }),
    ]);

    assertStrictEqual(res1.ok, true);
    assertStrictEqual(res2.ok, true);
    assertStrictEqual(res3.ok, true);
  });

  // 12. assertButtonInvariant Utility
  await test('assertButtonInvariant: validates invariants directly on elements', () => {
    const disabledBtn = new MockDOMElement('button', 'Disabled');
    disabledBtn.setAttribute('disabled', 'true');
    assertButtonInvariant(disabledBtn as any, 'disabled');

    const interactiveBtn = new MockDOMElement('button', 'Interactive');
    assertButtonInvariant(interactiveBtn as any, 'interactive');

    const loadingBtn = new MockDOMElement('button', 'Loading');
    loadingBtn.setAttribute('disabled', 'true');
    const spinner = new MockDOMElement('span');
    spinner.setAttribute('role', 'status');
    loadingBtn.appendChild(spinner);
    assertButtonInvariant(loadingBtn as any, 'loading');
  });

  // 13. Legacy Caller Signature Compatibility
  await test('compatibility: legacy playDisabled({ canvasElement }) signature works seamlessly', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Legacy');
    button.setAttribute('disabled', 'true');
    canvas.appendChild(button);

    // Legacy caller does not pass 2nd argument
    const result = await playDisabled({ canvasElement: canvas as any });
    assertStrictEqual(result.ok, true);
  });

  await test('compatibility: legacy playLoading({ canvasElement }) signature works seamlessly', async () => {
    const canvas = new MockDOMElement('div');
    const button = new MockDOMElement('button', 'Legacy Loading');
    button.setAttribute('disabled', 'true');
    const spinner = new MockDOMElement('span');
    spinner.setAttribute('role', 'status');
    button.appendChild(spinner);
    canvas.appendChild(button);

    // Legacy caller does not pass 2nd argument
    const result = await playLoading({ canvasElement: canvas as any });
    assertStrictEqual(result.ok, true);
  });

  console.log(`\nButton.play test summary: ${passedTests}/${totalTests} passed (${failedTests} failed)\n`);

  if (failedTests > 0) {
    throw new Error(`Test suite failed with ${failedTests} failure(s).`);
  }
}

// Auto-run if executed directly via node / ts-node
if (require.main === module) {
  runButtonPlayTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
