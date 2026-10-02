/**
 * Tests for .storybook/preview.ts — failure-path and boundary coverage.
 *
 * .storybook/preview.ts exports a static `Preview` object consumed as Storybook
 * project annotations (Storybook build/dev) and by .storybook/vitest.setup.ts
 * via `setProjectAnnotations([projectAnnotations])`. It has no runtime logic
 * of its own, so the invariants enforced here are structural + behavioral:
 *
 *   1. The default export is a non-null, non-array object (success path).
 *   2. `parameters.controls.matchers` defines exactly the expected `color`
 *      and `date` matchers as case-insensitive, end-anchored RegExps.
 *   3. Matcher behavior is deterministic for valid, invalid, duplicate, and
 *      boundary-case control names (no silent misclassification of args).
 *   4. Adversarial guards: matchers must be RegExp (not strings), must not be
 *      over-broad (`.*`), must remain distinct, and the config must not leak
 *      secret-like values.
 *   5. Determinism: repeated imports (retries) and concurrent imports resolve
 *      to deep-equal config; mutating a clone (stale state) cannot affect
 *      fresh imports; the export is safe to pass as a projectAnnotations entry
 *      (failure-recovery contract used by vitest.setup.ts).
 *
 * These tests run in a Node environment (no browser, no Storybook process).
 */

import { describe, it, expect } from "vitest";
import preview from "./preview";

type Matchers = {
  color?: unknown;
  date?: unknown;
  [key: string]: unknown;
};

function getMatchers(): Matchers {
  const p = (preview as { parameters?: { controls?: { matchers?: Matchers } } })
    .parameters;
  return p?.controls?.matchers ?? {};
}

// ---------------------------------------------------------------------------
// 1. Default export shape — success path
// ---------------------------------------------------------------------------

describe(".storybook/preview — default export", () => {
  it("exports a defined default export", () => {
    expect(preview).toBeDefined();
  });

  it("exports a non-null object (not a primitive)", () => {
    expect(typeof preview).toBe("object");
    expect(preview).not.toBeNull();
  });

  it("exports a plain object (not an array)", () => {
    expect(Array.isArray(preview)).toBe(false);
  });

  it("defines a parameters object", () => {
    const p = (preview as { parameters?: unknown }).parameters;
    expect(typeof p).toBe("object");
    expect(p).not.toBeNull();
  });

  it("defines parameters.controls as an object", () => {
    const controls = (
      preview as { parameters?: { controls?: unknown } }
    ).parameters?.controls;
    expect(typeof controls).toBe("object");
    expect(controls).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. controls.matchers invariants — success path
// ---------------------------------------------------------------------------

describe(".storybook/preview — controls.matchers shape", () => {
  it("defines a matchers object", () => {
    const matchers = getMatchers();
    expect(typeof matchers).toBe("object");
    expect(matchers).not.toBeNull();
  });

  it("defines exactly the expected matcher keys (color, date)", () => {
    const keys = Object.keys(getMatchers()).sort();
    expect(keys).toEqual(["color", "date"]);
  });

  it("color matcher is a RegExp (not a string)", () => {
    expect(getMatchers().color instanceof RegExp).toBe(true);
  });

  it("date matcher is a RegExp (not a string)", () => {
    expect(getMatchers().date instanceof RegExp).toBe(true);
  });

  it("color matcher has the exact expected source", () => {
    expect((getMatchers().color as RegExp).source).toBe("(background|color)$");
  });

  it("date matcher has the exact expected source", () => {
    expect((getMatchers().date as RegExp).source).toBe("Date$");
  });

  it("both matchers are case-insensitive", () => {
    const { color, date } = getMatchers() as {
      color: RegExp;
      date: RegExp;
    };
    expect(color.flags).toContain("i");
    expect(date.flags).toContain("i");
  });

  it("both matchers are end-anchored ($)", () => {
    const { color, date } = getMatchers() as {
      color: RegExp;
      date: RegExp;
    };
    expect(color.source.endsWith("$")).toBe(true);
    expect(date.source.endsWith("$")).toBe(true);
  });

  it("color and date matchers are distinct patterns", () => {
    const { color, date } = getMatchers() as {
      color: RegExp;
      date: RegExp;
    };
    expect(color.source).not.toBe(date.source);
  });
});

// ---------------------------------------------------------------------------
// 3. Matcher behavior — valid, invalid, duplicate, boundary inputs
// ---------------------------------------------------------------------------

describe(".storybook/preview — matcher behavior", () => {
  const color = () => getMatchers().color as RegExp;
  const date = () => getMatchers().date as RegExp;

  it("color matcher accepts canonical control names", () => {
    expect(color().test("background")).toBe(true);
    expect(color().test("color")).toBe(true);
  });

  it("color matcher accepts camelCase suffixed names (Storybook convention)", () => {
    expect(color().test("backgroundColor")).toBe(true);
    expect(color().test("primaryColor")).toBe(true);
  });

  it("color matcher is case-insensitive (boundary)", () => {
    expect(color().test("Background")).toBe(true);
    expect(color().test("COLOR")).toBe(true);
    expect(color().test("BACKGROUND")).toBe(true);
  });

  it("color matcher rejects non-suffixed and empty names", () => {
    expect(color().test("colorful")).toBe(false);
    expect(color().test("backgroundCheck")).toBe(false);
    expect(color().test("")).toBe(false);
  });

  it("date matcher accepts Date-suffixed control names", () => {
    expect(date().test("Date")).toBe(true);
    expect(date().test("endedDate")).toBe(true);
    expect(date().test("birthDate")).toBe(true);
  });

  it("date matcher rejects names that do not end with Date", () => {
    expect(date().test("")).toBe(false);
    expect(date().test("DatePicker")).toBe(false);
    expect(date().test("updated")).toBe(false);
  });

  it("duplicate evaluation is deterministic (same input, same result)", () => {
    for (const name of ["color", "backgroundColor", "endedDate", ""]) {
      const first = [color().test(name), date().test(name)];
      // Reset lastIndex in case a global flag is ever added (regression guard).
      color().lastIndex = 0;
      date().lastIndex = 0;
      const second = [color().test(name), date().test(name)];
      expect(second).toEqual(first);
    }
  });

  it("matchers do not throw on boundary inputs", () => {
    const inputs = ["", " ", "a", "$", "(background|color)$", "123", "🎨"];
    for (const input of inputs) {
      expect(() => color().test(input)).not.toThrow();
      expect(() => date().test(input)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Rejection / adversarial guards
// ---------------------------------------------------------------------------

describe(".storybook/preview — rejection and adversarial guards", () => {
  it("matchers are not over-broad (do not match everything)", () => {
    const { color, date } = getMatchers() as {
      color: RegExp;
      date: RegExp;
    };
    expect(color.source).not.toMatch(/\.\*/);
    expect(date.source).not.toMatch(/\.\*/);
    expect(color.test("definitely-not-a-color-control")).toBe(false);
  });

  it("matchers have no global flag (no shared lastIndex state)", () => {
    const { color, date } = getMatchers() as {
      color: RegExp;
      date: RegExp;
    };
    expect(color.global).toBe(false);
    expect(date.global).toBe(false);
  });

  it("config exposes no secret-like values (diagnosable, not sensitive)", () => {
    const serialized = JSON.stringify({
      color: String((getMatchers().color as RegExp).source),
      date: String((getMatchers().date as RegExp).source),
      keys: Object.keys(preview as object),
    }).toLowerCase();
    for (const banned of [
      "secret",
      "password",
      "token",
      "apikey",
      "api_key",
      "privatekey",
      "private_key",
    ]) {
      expect(serialized).not.toContain(banned);
    }
  });

  it("module has a default export usable as projectAnnotations entry", () => {
    // Mirrors the vitest.setup.ts contract:
    // setProjectAnnotations([projectAnnotations]) — the entry must be defined.
    const entry = preview;
    expect(entry).toBeDefined();
    expect(() => [entry]).not.toThrow();
    expect([entry].length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Retries, stale state, concurrency, failure recovery
// ---------------------------------------------------------------------------

describe(".storybook/preview — retries, stale state, and concurrency", () => {
  it("repeated imports resolve to deep-equal config (retry-safe)", async () => {
    const first = await import("./preview");
    const second = await import("./preview");
    expect(second.default).toEqual(first.default);
  });

  it("concurrent imports resolve to consistent config (no torn reads)", async () => {
    const copies = await Promise.all([
      import("./preview"),
      import("./preview"),
      import("./preview"),
      import("./preview"),
    ]);
    for (const copy of copies) {
      expect(copy.default).toEqual(preview);
    }
  });

  it("mutating a clone does not affect fresh imports (stale-state isolation)", async () => {
    const clone = structuredClone({
      parameters: (preview as { parameters: unknown }).parameters,
    }) as { parameters: { controls: { matchers: Record<string, unknown> } } };
    clone.parameters.controls.matchers.color = /mutated$/;
    clone.parameters.controls.matchers.extra = /evil$/;
    const fresh = await import("./preview");
    const freshMatchers = (
      fresh.default as { parameters: { controls: { matchers: object } } }
    ).parameters.controls.matchers;
    expect(Object.keys(freshMatchers).sort()).toEqual(["color", "date"]);
    expect((freshMatchers as { color: RegExp }).color.source).toBe(
      "(background|color)$",
    );
  });

  it("fresh import still satisfies the consumer contract after clone mutation", async () => {
    const fresh = await import("./preview");
    expect(fresh.default).toBeDefined();
    expect(typeof fresh.default).toBe("object");
    expect(Array.isArray(fresh.default)).toBe(false);
  });
});
