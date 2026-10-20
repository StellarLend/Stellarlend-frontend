import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, test } from "node:test";

const checker = resolve("scripts/check-lockfile.mjs");

test("accepts the repository lockfile", () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, [checker]));
});

test("rejects a lockfile using a non-npm registry", () => {
  const directory = mkdtempSync(join(tmpdir(), "check-lockfile-"));
  const fixture = join(directory, "package-lock.json");

  try {
    writeFileSync(
      fixture,
      JSON.stringify({
        packages: {
          "node_modules/example": {
            resolved: "https://evil.example/example-1.0.0.tgz",
            integrity: "sha512-c2FtcGxl",
          },
        },
      }),
    );
    assert.throws(
      () => execFileSync(process.execPath, [checker, fixture]),
      { status: 1 },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Additional cases from #1738 (run the checker as a CLI and inspect exit codes).
function runChecker(lockfileContent) {
  const directory = mkdtempSync(join(tmpdir(), "check-lockfile-"));
  const fixture = join(directory, "package-lock.json");
  try {
    writeFileSync(fixture, JSON.stringify(lockfileContent, null, 2));
    const output = execFileSync(process.execPath, [checker, fixture], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exitCode: 0, output };
  } catch (err) {
    return { exitCode: err.status, output: err.stderr || err.stdout };
  } finally {
    rmSync(directory, { recursive: true, force: true });
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
