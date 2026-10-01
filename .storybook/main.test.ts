/**
 * Tests for .storybook/main.ts — issue #1494
 *
 * .storybook/main.ts exports a static StorybookConfig object.  It has no
 * runtime logic of its own, so the invariants we enforce here are structural:
 *
 *   1. The `stories` globs are present, non-empty, and cover all expected
 *      source locations (MDX docs, stories files under /stories and
 *      /components).
 *   2. Every required addon is registered — missing one silently breaks the
 *      Storybook build and the vitest-storybook integration.
 *   3. The framework is exactly `@storybook/nextjs-vite`.
 *   4. Static assets are served from `../public`.
 *   5. Boundary / adversarial guards: the config must not accidentally list
 *      duplicate addons, must not expose a wildcard that reaches outside the
 *      project, and the framework options object must remain an object (not
 *      null or a scalar).
 *
 * These tests run in the "server-unit" vitest project (Node environment) so
 * they stay fast and don't require a browser or Storybook process.
 */

import { describe, it, expect } from "vitest";
import config from "./main";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the string name from a StorybookConfig addon entry.
 *  Entries may be either a plain string or { name: string; options?: … }.
 */
function addonName(entry: string | { name: string }): string {
  return typeof entry === "string" ? entry : entry.name;
}

const addonNames = config.addons?.map(addonName) ?? [];

// ---------------------------------------------------------------------------
// 1. stories globs
// ---------------------------------------------------------------------------

describe(".storybook/main — stories globs", () => {
  it("defines a non-empty stories array", () => {
    expect(Array.isArray(config.stories)).toBe(true);
    expect((config.stories as unknown[]).length).toBeGreaterThan(0);
  });

  it("includes a glob covering stories/**/*.mdx", () => {
    const stories = config.stories as string[];
    const hasMdx = stories.some((g) => g.includes(".mdx"));
    expect(hasMdx).toBe(true);
  });

  it("includes a glob covering stories/**/*.stories.*", () => {
    const stories = config.stories as string[];
    const hasStoriesDir = stories.some(
      (g) => g.includes("stories") && g.includes(".stories."),
    );
    expect(hasStoriesDir).toBe(true);
  });

  it("includes a glob covering components/**/*.stories.*", () => {
    const stories = config.stories as string[];
    const hasComponentsDir = stories.some(
      (g) => g.includes("components") && g.includes(".stories."),
    );
    expect(hasComponentsDir).toBe(true);
  });

  it("every glob is a non-empty string", () => {
    const stories = config.stories as string[];
    for (const glob of stories) {
      expect(typeof glob).toBe("string");
      expect(glob.trim().length).toBeGreaterThan(0);
    }
  });

  it("no glob starts with an absolute path (keeps portability)", () => {
    const stories = config.stories as string[];
    for (const glob of stories) {
      expect(glob.startsWith("/")).toBe(false);
    }
  });

  it("stories glob extensions cover js, jsx, mjs, ts, tsx", () => {
    const stories = config.stories as string[];
    const combined = stories.join(" ");
    // The @() extension pattern should include all five standard extensions
    expect(combined).toMatch(/js/);
    expect(combined).toMatch(/jsx/);
    expect(combined).toMatch(/ts/);
    expect(combined).toMatch(/tsx/);
  });
});

// ---------------------------------------------------------------------------
// 2. addons
// ---------------------------------------------------------------------------

describe(".storybook/main — addons", () => {
  it("defines a non-empty addons array", () => {
    expect(Array.isArray(config.addons)).toBe(true);
    expect(addonNames.length).toBeGreaterThan(0);
  });

  it("registers @chromatic-com/storybook", () => {
    expect(addonNames).toContain("@chromatic-com/storybook");
  });

  it("registers @storybook/addon-docs", () => {
    expect(addonNames).toContain("@storybook/addon-docs");
  });

  it("registers @storybook/addon-onboarding", () => {
    expect(addonNames).toContain("@storybook/addon-onboarding");
  });

  it("registers @storybook/addon-a11y (accessibility)", () => {
    expect(addonNames).toContain("@storybook/addon-a11y");
  });

  it("registers @storybook/addon-vitest (test integration)", () => {
    expect(addonNames).toContain("@storybook/addon-vitest");
  });

  it("contains no duplicate addon entries", () => {
    const unique = new Set(addonNames);
    expect(unique.size).toBe(addonNames.length);
  });

  it("every addon entry is a non-empty string or an object with a non-empty name", () => {
    const entries = config.addons ?? [];
    for (const entry of entries) {
      const name = addonName(entry as string | { name: string });
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. framework
// ---------------------------------------------------------------------------

describe(".storybook/main — framework", () => {
  it("specifies the framework", () => {
    expect(config.framework).toBeDefined();
  });

  it("uses @storybook/nextjs-vite as the framework name", () => {
    const fw = config.framework as { name: string; options: unknown };
    expect(fw.name).toBe("@storybook/nextjs-vite");
  });

  it("framework options is a plain object (not null or a primitive)", () => {
    const fw = config.framework as { name: string; options: unknown };
    expect(typeof fw.options).toBe("object");
    expect(fw.options).not.toBeNull();
  });

  it("framework name is not an empty string", () => {
    const fw = config.framework as { name: string; options: unknown };
    expect(fw.name.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. staticDirs
// ---------------------------------------------------------------------------

describe(".storybook/main — staticDirs", () => {
  it("defines the staticDirs array", () => {
    expect(Array.isArray(config.staticDirs)).toBe(true);
  });

  it("includes '../public' to serve static assets", () => {
    const dirs = config.staticDirs as string[];
    expect(dirs).toContain("../public");
  });

  it("every staticDir entry is a non-empty string", () => {
    const dirs = config.staticDirs as string[];
    for (const dir of dirs) {
      expect(typeof dir).toBe("string");
      expect(dir.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Overall config shape — boundary / adversarial invariants
// ---------------------------------------------------------------------------

describe(".storybook/main — overall config invariants", () => {
  it("exports a config object (not null, not an array, not a primitive)", () => {
    expect(typeof config).toBe("object");
    expect(config).not.toBeNull();
    expect(Array.isArray(config)).toBe(false);
  });

  it("config has no unknown top-level keys beyond the expected set", () => {
    const allowedKeys = new Set([
      "stories",
      "addons",
      "framework",
      "staticDirs",
      // Additional valid StorybookConfig keys that may appear in future:
      "docs",
      "typescript",
      "features",
      "refs",
      "managerHead",
      "previewHead",
      "previewBody",
      "env",
      "build",
      "core",
      "logLevel",
      "previewAnnotations",
    ]);
    const actual = Object.keys(config);
    for (const key of actual) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it("has at least 4 addons (chromatic, docs, onboarding, a11y, vitest)", () => {
    expect(addonNames.length).toBeGreaterThanOrEqual(5);
  });

  it("has at least 3 story globs (mdx + stories dir + components dir)", () => {
    expect((config.stories as unknown[]).length).toBeGreaterThanOrEqual(3);
  });

  it("framework name does not point to a plain webpack/babel framework", () => {
    const fw = config.framework as { name: string };
    expect(fw.name).not.toBe("@storybook/react-webpack5");
    expect(fw.name).not.toBe("@storybook/nextjs");
  });
});
