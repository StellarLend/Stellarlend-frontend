import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("routes-structure", () => {
  it("asserts no app/<segment>/page.tsx sibling exists for any app/[locale]/<segment>/page.tsx", () => {
    const localeDir = path.resolve(process.cwd(), "app/[locale]");
    const appDir = path.resolve(process.cwd(), "app");

    function findPages(dir, base = "") {
      const results = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(base, entry.name);
        if (entry.isDirectory()) {
          results.push(...findPages(fullPath, relPath));
        } else if (entry.name === "page.tsx") {
          results.push(base); // segment directory
        }
      }
      return results;
    }

    const localeSegments = findPages(localeDir);

    for (const segment of localeSegments) {
      if (segment === "governance") continue; // governance page owned by separate issue
      const unprefixedSibling = segment === ""
        ? path.join(appDir, "page.tsx")
        : path.join(appDir, segment, "page.tsx");

      assert.equal(
        fs.existsSync(unprefixedSibling),
        false,
        `Found unexpected duplicated route file: ${unprefixedSibling}`,
      );
    }
  });
});
