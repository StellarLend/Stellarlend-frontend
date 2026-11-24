import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";

const appRoot = process.cwd();
const css = readFileSync(join(appRoot, "app/globals.css"), "utf8");
const appManifest = manifest();

function cssColor(token: string): string | undefined {
  return css.match(new RegExp(`--${token}:\\s*(#[\\da-fA-F]{3,8})\\b`))?.[1];
}

describe("web app manifest", () => {
  it("uses the app's background and accent color tokens", () => {
    expect(appManifest.theme_color).toBe(cssColor("acc"));
    expect(appManifest.background_color).toBe(cssColor("bg"));
  });

  it("references icon assets that exist in the app or public directory", () => {
    expect(appManifest.icons).toBeDefined();
    expect(appManifest.icons?.length).toBeGreaterThan(0);

    for (const icon of appManifest.icons ?? []) {
      const iconPath = icon.src.replace(/^\/+/, "");
      expect(
        existsSync(join(appRoot, "app", iconPath)) ||
          existsSync(join(appRoot, "public", iconPath)),
      ).toBe(true);
    }
  });
});
