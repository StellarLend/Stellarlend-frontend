/**
 * scripts/check-lockfile.test.mjs
 *
 * Tests for the lockfile integrity checker.
 * Run with: node --test scripts/check-lockfile.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

function runChecker(lockfileContent) {
  const tmpPath = join(tmpdir(), `lockfile-test-${Date.now()}.json`);
  try {
    writeFileSync(tmpPath, JSON.stringify(lockfileContent, null, 2));
    const result = execSync(`node scripts/check-lockfile.mjs ${tmpPath}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exitCode: 0, output: result };
  } catch (err) {
    return { exitCode: err.status, output: err.stderr || err.stdout };
  } finally {
    try { unlinkSync(tmpPath); } catch {}
  }
}

const GOOD_LOCKFILE = {
  lockfileVersion: 3,
  packages: {
    "node_modules/some-pkg": {
      version: "1.0.0",
      resolved: "https://registry.npmjs.org/some-pkg/-/some-pkg-1.0.0.tgz",
      integrity: "sha512-abc123",
    },
  },
};

describe("check-lockfile", () => {
  it("exits 0 for a clean lockfile", () => {
    const { exitCode } = runChecker(GOOD_LOCKFILE);
    assert.equal(exitCode, 0);
  });

  it("exits 1 for a non-npmjs resolved URL", () => {
    const bad = {
      lockfileVersion: 3,
      packages: {
        "node_modules/evil-pkg": {
          version: "1.0.0",
          resolved: "https://evil-registry.example.com/evil-pkg/-/evil-pkg-1.0.0.tgz",
          integrity: "sha512-abc123",
        },
      },
    };
    const { exitCode, output } = runChecker(bad);
    assert.equal(exitCode, 1);
    assert.ok(output.includes("evil-registry.example.com"), `expected bad URL in output, got: ${output}`);
  });

  it("exits 1 for a git URL", () => {
    const bad = {
      lockfileVersion: 3,
      packages: {
        "node_modules/git-pkg": {
          version: "1.0.0",
          resolved: "git+https://github.com/attacker/evil-package.git",
          integrity: "sha512-abc123",
        },
      },
    };
    const { exitCode } = runChecker(bad);
    assert.equal(exitCode, 1);
  });

  it("exits 1 for a package missing integrity hash", () => {
    const bad = {
      lockfileVersion: 3,
      packages: {
        "node_modules/no-integrity": {
          version: "1.0.0",
          resolved: "https://registry.npmjs.org/no-integrity/-/no-integrity-1.0.0.tgz",
          // No integrity field
        },
      },
    };
    const { exitCode } = runChecker(bad);
    assert.equal(exitCode, 1);
  });

  it("skips workspace packages with no resolved URL", () => {
    const withWorkspace = {
      lockfileVersion: 3,
      packages: {
        "": { name: "my-app", version: "1.0.0" }, // workspace root — no resolved
        "node_modules/some-pkg": {
          version: "1.0.0",
          resolved: "https://registry.npmjs.org/some-pkg/-/some-pkg-1.0.0.tgz",
          integrity: "sha512-abc123",
        },
      },
    };
    const { exitCode } = runChecker(withWorkspace);
    assert.equal(exitCode, 0);
  });
});
