import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

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
